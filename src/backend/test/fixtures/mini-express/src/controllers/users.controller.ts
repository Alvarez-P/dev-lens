import { Router, Request, Response } from 'express';
import { CreateUserDto } from '../dto/create-user.dto';
import { UsersService } from '../services/users.service';

export class UsersController {
  readonly router: Router;

  constructor(private readonly usersService: UsersService) {
    this.router = Router();

    this.router.get('/users/:id', (req: Request<{ id: string }>, res: Response) => {
      const user = this.usersService.findById(req.params.id);
      res.json(user);
    });

    this.router.post('/users', (req: Request, res: Response) => {
      const dto: CreateUserDto = req.body as CreateUserDto;
      this.usersService.create({ id: 'new-user', ...dto });
      res.status(201).json(dto);
    });
  }
}
