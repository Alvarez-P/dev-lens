export interface User {
  id: string;
  name: string;
}

export class UsersService {
  private readonly users: User[] = [];

  findById(id: string): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  create(user: User): void {
    this.users.push(user);
  }
}
