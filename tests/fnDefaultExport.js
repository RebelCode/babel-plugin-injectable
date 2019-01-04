/**
 * @injectable
 *
 * @dependency {addServiceImplementation} addService
 */
export default function makeAdder (addService) {
  return (a, b) => addService.add(a, b)
}
