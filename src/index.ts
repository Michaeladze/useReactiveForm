import { useReactiveForm } from './useReactiveForm';

/** In interface of input values */
export interface IUseReactiveForm<T> {
  /** Form fields / structure */
  fields: T;
  /** If form is rendered dynamically, we need to pass a flag. True is set by default */
  visible?: boolean;
  /** Validation schema */
  schema?: any;
  /** Separator for name property of inputs. _ is set by default */
  separator?: string;
  /** Validate input on change */
  validateOnChange?: boolean;
  /** Action on change */
  actionOnChange?: (values: T) => void;
}

export default useReactiveForm;
