import express from 'express';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';

const app = express();
const usersService = new UsersService();
const usersController = new UsersController(usersService);

app.use(express.json());
app.use('/api', usersController.router);

app.listen(3000);
