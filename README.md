# useReactiveForm

React hook for gathering form data with out unnecessary re-renders. 

The idea is that form state is stored in `BehaviorSubject` from `rxjs`. When it changes,
it does not re-render the component. Ways to re-render form:
1. Call `validate()` function.
2. Use `validateOnChange: true` which is basically the same as #1. If after validation message of the error
has not changed, component **will not** re-render.
3. Call `update()` function.
___


### Instructions:
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
    visible?: boolean - If form is rendered dynamically, we need to pass a flag. True is set by default  
    schema?: any - Validation schema  
    separator?: string - Separator for name property of inputs. _ is set by default  
    validateOnChange?: boolean - Validate input on change  

#### Step 4: Use Hook

    const { values, ref, update, validate, getErrors, clear } = useReactiveForm<IFormData>(config);
    
    /**
    values() - get current form state
    ref - reference to <form> tag
    validate() - function which validates the form
    getErrors() - function which gets errors after validation
    clear() - function which form values form and errors
    update() - function which re-renders form. It is needed in case when you dynamically add fields.
    **/
    
#### Step 5: Connect hook to the form.

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
          console.log(values());
        } else {
          console.log(getErrors());
        }
      };
    
    return (
      <form ref={ref} onSubmit={onSubmit}>
      
        <div>
          <input type='text' name={'user'} defaultValue={values().name}/>
          { getErrors().user.error && <p> {getErrors().user.error} </p> }
        </div>
      
        {
        values().books.map((b, i: number) => (
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
But instead of common separators (`.`, `[]`) use `_` or your separator described in `config`.  

To get error message just call `getError()` function. It returns object with the same structure as your
form object, but instead of just values it contains object `{ value: string, error: string }`. 
Therefore, error message for `user` field is located in `getErrors().user.error`.

Any action triggered on the `<input/>` will provide it with one of the following classes:   `touched`, `dirty` or `invalid`.
___
#### Dynamic fields.

If you want to add some fields dynamically, you need to use `update()` function. 
Lets say you want to add new book. You will need to copy `values()` and push new book object to the `values().books` array.

    const addBook = () => {
        update({
          ...values(),
          books: [...values().books, {
            title: '',
            author: ''
          }]
        });
      };
      
    <button type='button' onClick={addBook}> Add book </button>
