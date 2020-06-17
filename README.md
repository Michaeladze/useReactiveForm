# useReactiveForm

React hook for gathering and validating form data without unnecessary re-renders. 

**Links:**  
[1. Example](https://stackblitz.com/edit/react-ts-edmmec?file=Example.tsx)   
[2. NPM](https://www.npmjs.com/package/use-reactive-form)  
[3. GitHub](https://github.com/Michaeladze/useReactiveForm)  
[4. Medium](https://medium.com/swlh/painless-react-form-handling-with-usereactiveform-827312878458?source=friends_link&sk=d86dfa4f1ce34549dc448296fb510dda)


### Install:
    npm install use-reactive-form
    yarn add use-reactive-form


### Usage:

The idea is that form state stored in `useRef`. When it changes,
it does not re-render the component. Ways to re-render form:
1. Call `validate()` function.
2. Use `validateOnChange: true` which is basically the same as #1. If after validation message of the error
has not changed, the component **will not** re-render.
3. Call `update()` function.
___

#### Step 1: Describe initial values and interface.

    interface IFormData = {
        user: string;
        books: {
            title: string;
            author: string;
        }[]
    }
    
    const initial: IFormData = {
        user: '',
        books: [
          {
            title: '',
            author: '',  
          }
        ],
    }

#### Step 2: [Optional] Describe validation schema in Yup syntax.

    import { array, object, string } from 'yup';
    
    // ...
    
    const validation = object().shape({
        user: string().required('This field is required')
                      .max(20, 'Character limit exceeded'),
        books: array().of(object().shape({
          title: string().required('This field is required'),
          author: string().required('This field is required'),
        })),
    });

#### Step 3: Create config.

    import { IUseReactiveForm } from 'use-reactive-form';
    
    // ...
    
    const config: IUseReactiveForm<IFormData> = {
        fields: initial,
        schema: validation,
        validateOnChange: true
      };
   
##### Config keys:   
    fields: T - Form fields / structure  
    deps?: boolean[] - Array of boolean dependencies that trigger re-render 
    schema?: any - Validation schema  
    separator?: string - Separator for name property of inputs. _ is set by default  
    validateOnChange?: boolean - Validate on input change
    actionOnChange?: (values: T) => void - Fire function on input change
    updateTriggers? string[] - array of name attributes whose change triggers re-render

#### Step 4: Use Hook

    const { values, ref, update, validate, clear } = useReactiveForm<IFormData>(config);
    
    /**
    values - get current form state
    ref - reference to <form> tag
    validate() - function which validates the form
    errors - gets errors after validation 
    clear() - function which form values form and errors
    update() - function which re-renders form. It is needed in case when you dynamically add fields.
    **/
    
#### Step 5: Connect hook to the form.

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
          console.log(values);
        } else {
          console.log(errors);
        }
      };
    
    return (
      <form ref={ref} onSubmit={onSubmit}>
      
        <div>
          <input type='text' name={'user'} defaultValue={values.name}/>
          { errors.user.error && <p> {errors.user.error} </p> }
        </div>
      
        {
        values.books.map((b, i: number) => (
            <div key={`book${i}`}>
                <input type='text' name={`books_${i}_title`}/>
                <input type='text' name={`books_${i}_author`}/>    
            </div>
          ))
        }
      
        <button type='submit' onClick={onSubmit}> Submit </button>
      
      </form>
    )
    
Notice, that you have to describe `name` attribute as a path to the key in your form object.
Instead of common separators (`.`, `[]`) use `_` or your separator described in `config`.  

To get error message use `errors`. It is an object with the same structure as your
form object, but instead of just values, it contains object `{ value: string, error: string }`. 
Therefore, error message for `user` field located in `errors.user.error`.

Any action triggered on the `<input/>` will provide it with one of the following classes:   `touched`, `dirty` or `invalid`.
___
#### Dynamic fields.

If you want to add some fields dynamically, you need to use `update()` function. 
Let's say you want to add a new book. You will need to copy `values` and push a new book object to the `values.books` array.

    const addBook = () => {
        update({
          ...values,
          books: [...values.books, {
            title: '',
            author: ''
          }]
        });
      };
      
    <button type='button' onClick={addBook}> Add book </button>

___
#### Action on input change.
`actionOnChange` is a parameter, which you may want to set to `true` when you have to fire 
a function when any of the inputs value changes. It may be desirable when you submit form dynamically.
