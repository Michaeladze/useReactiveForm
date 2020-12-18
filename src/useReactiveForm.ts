import {
  Ref, RefObject, useEffect, useMemo, useRef, useState
} from 'react';

/** In interface of input values */
export interface IUseReactiveForm<T> {
  /** Form fields / structure */
  fields: T;
  /** Dependencies */
  deps?: any[];
  /** Validation schema */
  schema?: any;
  /** Separator for name property of inputs. _ is set by default */
  separator?: string;
  /** Validate input on change */
  validateOnChange?: boolean;
  /** Action on change */
  actionOnChange?: (values: T) => void;
  /** Update when specific name changes */
  updateTriggers?: string[];
}

/** Element type */
export type IField = HTMLInputElement | HTMLTextAreaElement;

/** Interface of return values */
export interface IUseFormResult<T> {
  ref: Ref<HTMLFormElement>;
  values: T;
  errors: any;
  update: (f: T) => void;
  validate: () => boolean;
  clear: () => void;
}

export const useReactiveForm = <T>({
                                     fields,
                                     schema,
                                     deps = [],
                                     separator = '_',
                                     validateOnChange = false,
                                     actionOnChange,
                                     updateTriggers = []
                                   }: IUseReactiveForm<T>): IUseFormResult<T> => {
  /** Form reference */
  const ref = useRef<HTMLFormElement>(null);
  /** Reload function */
  const [time, reload] = useState(0);
  /** Form data */
  let form = useRef<T>(fields);
  /** Validation object */
  let validationObject = useRef(deepCopy(fields));
  /** Errors map for preventing re-renders on same error on dynamic validation */
  const errorsMap = useRef(new Map());

  /** Map of existing fields */
  const fieldsMap = useMemo(() => {
    return flattenObject(fields, ref, separator);
  }, [fields]);

  // ===================================================================================================================

  /** Action callback subscription */
  const action = (e: Event) => {
    const element = e.target as IField;
    const name = element.getAttribute('name');

    /** Refresh values and errors with new value */
    const keys = name ? name.split(separator) : [];
    findKeyAndUpdateValue(keys, form.current, element);
    findKeyAndUpdateValue(keys, validationObject.current, element);

    actionOnChange && actionOnChange(form.current);
  };

  // ===================================================================================================================

  /** Event subscription */
  const sub = (e: Event) => {
    const element = e.target as IField;

    const type = element.getAttribute('type');
    const name = element.getAttribute('name');

    /** We don't need blur event on radio or checkboxes */
    if (e.type === 'blur' && (type === 'radio' || type === 'checkbox')) {
      return;
    }

    if (e.type === 'focus' && (type === 'radio' || type === 'checkbox')) {
      const elements: NodeListOf<IField> | null = ref.current && ref.current.querySelectorAll(`[name="${name}"]`);
      elements && elements.forEach((e: IField) => e.classList.add('touched'));
      return;
    }

    if (e.type === 'focus' && !element.classList.contains('touched')) {
      element.classList.add('touched');
      return;
    }

    if (type === 'radio' || type === 'checkbox') {
      const elements: NodeListOf<IField> | null = ref.current && ref.current.querySelectorAll(`[name="${name}"]`);
      elements && elements.forEach((e: IField) => e.classList.add('dirty'));
    } else if (e.type === 'change') {
      element.classList.add('dirty');
    }

    /** Refresh values and errors with new value */
    const keys = name ? name.split(separator) : [];
    findKeyAndUpdateValue(keys, form.current, element);
    findKeyAndUpdateValue(keys, validationObject.current, element);

    /** Run validation */
    validateOnChange && dynamicValidation(name, form.current, element);

    /** Update on names change */
    if (updateTriggers && name && updateTriggers.indexOf(name) >= 0) {
      update(form.current);
    }
  };

  // ===================================================================================================================

  /** Subscribe and resubscribe when update() called */
  useEffect(() => {
    let selectors: any = [];
    let event = 'change';

    if (ref.current) {
      /** Find inputs and subscribe to value change */
      selectors = ref.current.querySelectorAll('[name]');
      selectors.forEach((field: IField) => {
        const name = field.getAttribute('name');
        if (name && fieldsMap[name]) {
          if (actionOnChange) {
            field.addEventListener(event, action);
          } else {
            field.addEventListener(event, sub);
            field.addEventListener('focus', sub);
            field.addEventListener('blur', sub);
          }
        }
      });
    }
    return () => {
      selectors.forEach((field: any) => {
        field.removeEventListener(event, sub);
        field.removeEventListener('focus', sub);
        field.removeEventListener('blur', sub);
        field.removeEventListener(event, action);
      });
    };
  }, [time, fieldsMap]);

  // ===================================================================================================================

  /** Refresh form when visibility changes */
  useEffect(() => {
    deps.length && update(fields);
  }, [...deps]);

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
          error: error
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
          obj[keys[0]] =
            index < 0 ? [...obj[keys[0]], element.value] : obj[keys[0]].filter((v: any) => v !== element.value);
        } else if (element.getAttribute('type') === 'radio') {
          obj[keys[0]] = typeof obj[keys[0]] === 'number' ? +element.value : element.value;
        } else if (element.tagName === 'SELECT') {
          const multiple = element.getAttribute('multiple');
          if (multiple === '' || multiple) {
            if (!Array.isArray(obj[keys[0]])) {
              obj[keys[0]] = [];
            }

            obj[keys[0]] = Array.from(element.getElementsByTagName('option'))
              .filter((o: HTMLOptionElement) => o.selected)
              .map((o: HTMLOptionElement) => o.value);
          } else {
            obj[keys[0]] = element.value;
          }
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
    form.current = fields;
    validationObject.current = deepCopy(fields, validationObject.current);
    reload(Date.now());
  };

  // ===================================================================================================================

  /** Validate form by schema */
  const validate = (): any => {
    if (!schema) {
      return true;
    }

    const elements: NodeListOf<IField> | null =
      ref.current && ref.current.querySelectorAll('input.invalid, textarea.invalid');
    elements && elements.forEach((e: IField) => e.classList.remove('invalid'));

    validationObject.current = deepCopy(form.current);

    try {
      schema.validateSync(form.current, { abortEarly: false });
      update(form.current);

      return true;
    } catch (e) {
      e.inner.forEach((item: any) => {
        errorsMap.current.set(item.path, e.message);

        /** Fill validationObject with error messages */
        const keys = item.path.split(/\[|].|\./);
        findKeyAndUpdateValue(keys, validationObject.current, null, item.message);

        const selector = item.path.replace(/[[.]/g, separator).replace(/]/g, '');
        const elements: NodeListOf<IField> | null = ref.current && ref.current.querySelectorAll(`[name="${selector}"]`);
        elements && elements.forEach((e: IField) => e.classList.add('invalid'));
      });

      reload(Date.now());
      return false;
    }
  };

  // ===================================================================================================================

  /** Validate when value of input changed */
  const dynamicValidation = (name: string | null, values: T, element: IField) => {
    let path;
    path = name
      ? name
        .replace(new RegExp(separator, 'g'), '_')
        .replace(/(_)/g, (_, sign: string, offset: number) =>
          /\d/g.test(name[offset + 1]) ? '[' : /\d/g.test(name[offset - 1]) ? ']' : sign
        )
        .replace(/(])/g, (_, sign: string, offset: number) => (/\w/g.test(name[offset + 1]) ? '].' : sign))
      : '';

    const type = element.getAttribute('type');
    let shouldUpdate;
    let valid: boolean;

    // Reload for visual change
    const isSelect: boolean = element.getAttribute('data-select') === 'true';

    const errors = validationObject.current;
    const keys = name ? name.split(separator) : [];

    try {
      schema.validateSyncAt(path, values);
      valid = true;
      shouldUpdate = errorsMap.current.get(path) !== '' && errorsMap.current.get(path) !== undefined;
      errorsMap.current.set(path, '');
      findKeyAndUpdateValue(keys, errors, element);
    } catch (e) {
      valid = false;
      shouldUpdate = errorsMap.current.get(path) !== e.message;
      errorsMap.current.set(path, findKeyAndUpdateValue(keys, errors, element, e.message).error);
    }

    validationObject.current = errors;

    if (type === 'radio' || type === 'checkbox') {
      const elements: NodeListOf<IField> | null = ref.current && ref.current.querySelectorAll(`[name="${name}"]`);
      elements &&
      elements.forEach((e: IField) => {
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

  return {
    values: form.current,
    ref,
    update,
    validate,
    clear,
    errors: validationObject.current
  };
};

/** Deep copy object */
function deepCopy(obj: any, preserve?: any): any {
  let clone: any = {};

  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && obj[key] !== undefined && !(obj[key] instanceof Date)) {
      clone[key] = preserve ? deepCopy(obj[key], preserve[key]) : deepCopy(obj[key]);
    } else {
      clone[key] = preserve && key ? preserve[key] : obj[key];
    }
  }

  return clone;
}

/** Flatten object */
function flattenObject(
  obj: any,
  ref: RefObject<HTMLFormElement>,
  separator = '_',
  key: string = '',
  map: any = {},
  isArray: boolean = false
): any {
  if (typeof obj === 'object' && obj !== null && obj !== undefined && !(obj instanceof Date)) {
    Object.keys(obj).forEach((k: string) => {
      const newKey = !key ? k : separator + k;
      flattenObject(obj[k], ref, separator, (key += newKey), map, Array.isArray(obj));
      key = key.replace(newKey, '');
    });
  } else {
    if (isArray) {
      const splitKey = key.split('_');
      const lastIndex = splitKey.pop();
      const isArrayIndex = lastIndex && !isNaN(+lastIndex);

      if (isArrayIndex) {
        map[splitKey.join('_')] = true;
      }
    } else {
      map[key] = true;
    }
  }
  return map;
}
