/**
 * Abstract base for value objects.
 * Value objects are immutable and compared by structural equality.
 */
export abstract class ValueObject {
  /**
   * Returns the component values used for equality comparison.
   * Must be overridden by subclasses.
   */
  protected abstract getEqualityComponents(): unknown[];

  equals(other: ValueObject): boolean {
    if (other == null || other.constructor !== this.constructor) {
      return false;
    }

    const thisComponents = this.getEqualityComponents();
    const otherComponents = other.getEqualityComponents();

    if (thisComponents.length !== otherComponents.length) {
      return false;
    }

    return thisComponents.every((component, index) =>
      Object.is(component, otherComponents[index]),
    );
  }
}
