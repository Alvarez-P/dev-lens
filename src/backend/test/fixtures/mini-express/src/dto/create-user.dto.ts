export class CreateUserDto {
  constructor(
    public readonly name: string,
    public readonly age?: number,
  ) {}
}
