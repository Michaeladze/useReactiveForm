import { Ref, useEffect, useRef, useState } from 'react';
import { BehaviorSubject, fromEvent, Subject } from 'rxjs';
import { debounceTime, map, takeUntil } from 'rxjs/operators';
import { ValidationError } from 'yup';

/** In interface of input values */
export interface IUseReactiveForm<T> {
  /** Form fields / structure */
  fields: T;
  /** If form is rendered dynamically, we need to pass a flag. True is set by default */
  visible?: boolean;
  /** Dependencies */
  deps?: boolean[];
  /** Validation schema */
  schema?: any;
  /** Separator for name property of inputs. _ is set by default */
  separator?: string;
  /** Validate input on change */
  validateOnChange?: boolean;
  /** Action on change */
  actionOnChange?: (values: T) => void;
}

/** Validation object */
export interface IValidationResult {
  value: string;
  error: string;
}

/** Тип элемента */
export type IField = HTMLInputElement | HTMLTextAreaElement;

/** Interface of return values */
export interface IUseFormResult<T> {
  values: () => T;
  ref: Ref<HTMLFormElement>;
  update: (f: T) => void;
  validate: () => boolean;
  getErrors: () => any;
  clear: () => void;
}

export const useReactiveForm = <T>({
                                     fields,
                                     schema,
                                     visible = true,
                                     deps = [],
                                     separator = '_',
                                     validateOnChange = false,
                                     actionOnChange,
                                   }: IUseReactiveForm<T>): IUseFormResult<T> => {

  /** Deep copy object */
  const deepCopy = (obj: T): T => JSON.parse(JSON.stringify(obj));

  /** Form reference */
  const ref = useRef<HTMLFormElement>(null);
  /** Unsubscribe from subject */
  const unsubSub = new Subject();
  /** Reload function */
  const [time, reload] = useState(0);
  /** Form data */
  const [form] = useState(new BehaviorSubject<T>(fields));
  /** Validation object */
  let [validationObject] = useState(new BehaviorSubject<T>(deepCopy(fields)));
  /** Errors map for preventing re-renders on same error on dynamic validation */
  const [errorsMap] = useState(new Map());

  // ===================================================================================================================

  /** Get values */
  const getValues = () => form.getValue();
  /** Get errors */
  const getErrors = () => validationObject.getValue();

  // ===================================================================================================================

  /** Action callback subscription */
  const action = (selector: HTMLElement, event: string, cb: (a: Event) => any) => {
    fromEvent(selector, event).pipe(
      takeUntil(unsubSub),
      debounceTime(300),
      map(cb),
    ).subscribe((element: IField) => {
      const isSelect: boolean = element.getAttribute('data-select') === 'true';
      const name = element.getAttribute('name');

      /** Refresh values and errors with new value */
      const values = getValues();
      findKeyAndUpdateValue(name ? name.split(separator) : [], values, element);
      form.next(values);

      actionOnChange && actionOnChange(values);

      if (isSelect) {
        reload(Date.now());
      }
    });
  };

  // ===================================================================================================================

  /** Event subscription */
  const sub = (selector: HTMLElement, event: string, cb: (a: Event) => any) => {
    fromEvent(selector, event).pipe(
      takeUntil(unsubSub),
      debounceTime(200),
      map(cb),
    ).subscribe((element: IField) => {

      const type = element.getAttribute('type');
      const name = element.getAttribute('name');

      /** We don't need blur event on radio or checkboxes */
      if (event === 'blur' && (type === 'radio' || type === 'checkbox')) {
        return;
      }

      if (event === 'focus' && (type === 'radio' || type === 'checkbox')) {
        const elements: NodeListOf<IField> | null = ref.current && ref.current.querySelectorAll(`[name="${name}"]`);
        elements && elements.forEach((e: IField) => e.classList.add('touched'));
        return;
      }

      if (event === 'focus' && !element.classList.contains('touched')) {
        element.classList.add('touched');
        return;
      }

      if (type === 'radio' || type === 'checkbox') {
        const elements: NodeListOf<IField> | null = ref.current && ref.current.querySelectorAll(`[name="${name}"]`);
        elements && elements.forEach((e: IField) => e.classList.add('dirty'));
      } else {
        element.classList.add('dirty');
      }

      /** Refresh values and errors with new value */
      const values = getValues();
      findKeyAndUpdateValue(name ? name.split(separator) : [], values, element);
      form.next(values);

      /** Run validation */
      validateOnChange && dynamicValidation(name, values, element);
    });
  };

  // ===================================================================================================================

  /** Subscribe and resubscribe when update() called */
  useEffect(() => {
    unsubSub.next(Date.now());

    if (ref.current) {
      /** Find inputs and subscribe to value change */
      const selectors = ref.current.querySelectorAll('[name]');
      selectors.forEach((field: any) => {
        let event = 'click';
        const isSelect: boolean = field.getAttribute('data-select') === 'true';

        if ((field.nodeName === 'INPUT' && (field.getAttribute('type') === 'text' ||
          field.getAttribute('type') === 'password')) ||
          field.nodeName === 'TEXTAREA') {
          event = 'keyup';
        }

        if (field.nodeName === 'SELECT' || isSelect) {
          // для ie поменяла событие с input на change
          event = 'change';
        }

        const subCallback = (e: Event) => (e.target as IField); // callback when subscribe fires

        if (actionOnChange) {
          action(field, event, subCallback);
        } else {
          sub(field, event, subCallback);
          sub(field, 'focus', subCallback);
          sub(field, 'blur', subCallback);
        }
      });
    }
    return () => unsubSub.next(Date.now());
  }, [time]);

  // ===================================================================================================================

  /** Refresh form when visibility changes */
  useEffect(() => {
    visible && deps.every((b: boolean) => b) && update(fields);
  }, [visible, ...deps]);

  // ===================================================================================================================

  /** Recursion for updating form value */
  const findKeyAndUpdateValue = (keys: string[], obj: any, element: IField | null, error?: string): any => {

    if (!keys.length) {
      return;
    }

    if (keys.length === 1) {
      /** If there is error message (create validationObject) */
      if (error) {
        obj[keys[0]] = {
          value: obj[keys[0]],
          error: error,
        };

        return obj[keys[0]];
      }

      if (element) {
        /** If checkbox then check the presence of the value in array */
        if (element.getAttribute('type') === 'checkbox') {
          if (!Array.isArray(obj[keys[0]])) {
            obj[keys[0]] = [];
          }
          const index = obj[keys[0]].indexOf(element.value);
          obj[keys[0]] = index < 0 ? [...obj[keys[0]], element.value] : obj[keys[0]].filter((v: any) => v !== element.value);
        } else if (element.getAttribute('type') === 'radio') {
          obj[keys[0]] = typeof obj[keys[0]] === 'number' ? +element.value : element.value;
        } else {
          obj[keys[0]] = element.value;
        }
      }

      return obj[keys[0]];
    }

    /** Recursion over @param obj */
    for (const k in obj) {
      if (obj.hasOwnProperty(k) && k === keys[0]) {
        const tmp = [...keys];
        tmp.splice(0, 1);
        return findKeyAndUpdateValue(tmp, obj[k], element, error);
      }
    }
  };

  // ===================================================================================================================

  /** Update subject with new values and fields. Update validation object with new structure. */
  const update = (fields: T) => {
    form.next(fields);
    validationObject.next(deepCopy(fields));
    reload(Date.now());
  };

  // ===================================================================================================================

  /** Validate form by schema */
  const validate = (): boolean => {
    if (!schema) {
      return true;
    }

    const elements: NodeListOf<IField> | null = ref.current && ref.current.querySelectorAll('input.invalid, textarea.invalid');
    elements && elements.forEach((e: IField) => e.classList.remove('invalid'));

    const values = form.getValue();
    validationObject.next(deepCopy(values));

    try {
      schema.validateSync(values, { abortEarly: false });
      update(values);

      return true;
    } catch (e) {
      const errors = validationObject.getValue();

      e.inner.forEach((item: ValidationError) => {
        errorsMap.set(item.path, e.message);

        /** Fill validationObject with error messages */
        const keys = item.path.split(/\[|].|\./);
        findKeyAndUpdateValue(keys, errors, null, item.message);

        const selector = item.path.replace(/[[.]/g, separator).replace(/]/g, '');
        const elements: NodeListOf<IField> | null = ref.current && ref.current.querySelectorAll(`[name="${selector}"]`);
        elements && elements.forEach((e: IField) => e.classList.add('invalid'));
      });

      validationObject.next(deepCopy(errors));
      reload(Date.now());
      return false;
    }
  };

  // ===================================================================================================================

  /** Validate when value of input changed */
  const dynamicValidation = (name: string | null, values: T, element: IField) => {
    let path;
    path = name ? name.replace(new RegExp(separator, 'g'), '_')
      .replace(/(_)/g, (_, sign: string, offset: number) =>
        /\d/g.test(name[offset + 1]) ? '[' : /\d/g.test(name[offset - 1]) ? ']' : sign)
      .replace(/(])/g, (_, sign: string, offset: number) =>
        /\w/g.test(name[offset + 1]) ? '].' : sign) : '';

    const type = element.getAttribute('type');
    let shouldUpdate;
    let valid: boolean;

    // Reload for visual change
    const isSelect: boolean = element.getAttribute('data-select') === 'true';

    const errors = validationObject.getValue();
    const keys = name ? name.split(separator) : [];

    try {
      schema.validateSyncAt(path, values);
      valid = true;
      shouldUpdate = errorsMap.get(path) !== '' && errorsMap.get(path) !== undefined;
      errorsMap.set(path, '');
      findKeyAndUpdateValue(keys, errors, element);
    } catch (e) {
      valid = false;
      shouldUpdate = errorsMap.get(path) !== e.message;
      errorsMap.set(path, findKeyAndUpdateValue(keys, errors, element, e.message).error);
    }

    validationObject.next(deepCopy(errors));

    if (type === 'radio' || type === 'checkbox') {
      const elements: NodeListOf<IField> | null = ref.current && ref.current.querySelectorAll(`[name="${name}"]`);
      elements && elements.forEach((e: IField) => {
        valid ? e.classList.remove('invalid') : e.classList.add('invalid');
      });
    } else {
      valid ? element.classList.remove('invalid') : element.classList.add('invalid');
    }

    if (isSelect) {
      reload(Date.now());
    } else {
      shouldUpdate && reload(Date.now());
    }
  };

  // ===================================================================================================================

  /** Clear fields */
  const clear = () => update(fields);

  // ===================================================================================================================

  return { values: getValues, ref, update, validate, getErrors, clear };
};
