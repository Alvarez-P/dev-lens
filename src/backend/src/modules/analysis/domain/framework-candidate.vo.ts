export interface FrameworkCandidateProps {
  framework: string;
  file: string;
  markers: string[];
}

export class FrameworkCandidate {
  public readonly framework: string;
  public readonly file: string;
  public readonly markers: readonly string[];

  private constructor(props: FrameworkCandidateProps) {
    this.framework = props.framework;
    this.file = props.file;
    this.markers = [...props.markers];
    Object.freeze(this);
  }

  static create(props: FrameworkCandidateProps): FrameworkCandidate {
    const framework = props.framework.trim();

    if (framework.length === 0) {
      throw new Error('Framework name must not be blank');
    }

    if (props.file.trim().length === 0) {
      throw new Error('Manifest file must not be blank');
    }

    if (props.markers.length === 0) {
      throw new Error('Framework candidate requires at least one marker');
    }

    return new FrameworkCandidate({
      framework,
      file: props.file,
      markers: props.markers,
    });
  }

  toJSON(): { framework: string; file: string; markers: string[] } {
    return {
      framework: this.framework,
      file: this.file,
      markers: [...this.markers],
    };
  }
}
