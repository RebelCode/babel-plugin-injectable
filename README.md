# Babel Plugin Injectable
Adds ability to mark objects as `injectable` so the DI container can automatically create instances and resolve dependencies. This plugin also adds the list of function (or constructor params) to the marked object. So the DI container shouldn't do in runtime.
## Install
Run:
```
$ npm install --save-dev @rebelcode/plugin-injectable
```

And add `@rebelcode/plugin-injectable` plugin to your `.babelrc`
## Details

After applying the plugin this code:
```js
/**
 * @injectable
 */
export default function makeAdder (addService) {
  return (a, b) => addService.add(a, b)
}
```

Becomes this during transpilation:
```js
/**
 * @injectable
 */
const makeAdder = function makeAdder(addService) {
  return (a, b) => addService.add(a, b);
};
makeAdder.$injectParams = {
  "addService": {
    "from": "addService"
  }
};
makeAdder.$injectable = true;
export default makeAdder;
```

After that the DI container can see the `$injectable` property on the class or function. So it can automaticaly create the service and resolve it's dependencies (parameters listed in `$injectParams` property).

By default, DI container will look for the service with exact param's name. But often you have implementations under different names. Or maybe you don't have implementation at all and want to use some simple default value. So to make dependency aliases use `@dependency` word in JS doc near function definition or a constructor.

```js

/**
 * @injectable
 * 
 * @dependency {addServiceImplementation = {}} addService
 */
export default function makeAdder (addService) {
  return (a, b) => addService.add(a, b)
}

// Plugin will generate this
makeAdder.$injectParams = {
  "addService": {
    "from": "addServiceImplementation",
    "default": {}
  }
};
```

### Injectable classes
Using `@injectable` with classes to create new class instance with automatically resolved constructor dependencies.

To redefine the created instance name, set it after `@injectable` word in the comment block. Factory function preferred name can be also rewritten. 
```js
/**
 * @injectable fooService
 */
class FooCoolService {
  constructor (moment) {
    // ...
  }
}
```
The plugin will add these fields:
 ```js 
FooCoolService.$injectable = true;
FooCoolService.$injectParams = {
    "moment": {
        "from": "moment"
    }
};
FooCoolService.$injectAs = "fooService";
FooCoolService.$injectNewInstance = true;
```
 So the DI container can:
 1. Use that name `fooService` to create new instance of the service.
 2. Create new instance of `FooCoolService` in container with automaticaly resolved dependencies.
 
 ### Development
 To run babel transformation:
 ```sh
$ cd ./src
$ ./node_modules/.bin/babel ./tests/fnDefaultClassExport.js --plugins ./../src
 ```
 