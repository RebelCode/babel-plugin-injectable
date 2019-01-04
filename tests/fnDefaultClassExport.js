/**
 * @injectable
 */
export default class Foo {
  /**
   * @param moment
   * @param config
   *
   * @dependency {momentService} moment
   * @dependency {config.state.fooConfig = []} config
   */
  constructor (moment, config) {
    // ...
  }
}