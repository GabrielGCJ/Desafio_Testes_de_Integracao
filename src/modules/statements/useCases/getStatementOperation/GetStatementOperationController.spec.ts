import { Connection, createConnection, Repository } from "typeorm"
import request from 'supertest';
import { hash } from 'bcryptjs';
import { sign } from 'jsonwebtoken';

import authConfig from '../../../../config/auth';
import { app } from "../../../../app";

import { User } from "../../../users/entities/User";
import { Statement } from "../../entities/Statement";

let connection: Connection;
let usersRepository: Repository<User>;
let statementsRepository: Repository<Statement>;
let user: User;
let userId: string;
let token: string;
let statementId: string;

enum OperationType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
}

describe('Obter operação de extrato', () => {
  beforeAll(async () => {
    connection = await createConnection();
    await connection.runMigrations();

    statementsRepository = connection.getRepository<Statement>(Statement);
    usersRepository = connection.getRepository<User>(User);

    user = usersRepository.create({
      name: 'Name sample',
      email: 'namesample@email.com',
      password: await hash('123', 8)
    });

    user = await usersRepository.save(user);

    userId = (user?.id) ? user.id : 'not-valid-id'

    const { secret, expiresIn } = authConfig.jwt;

    token = sign({ user }, secret, {
      subject: user.id,
      expiresIn,
    });

    const statement = statementsRepository.create({
      user_id: user.id,
      amount: 100,
      description: 'Deposit Sample',
      type: 'deposit' as OperationType
    });

    await statementsRepository.save(statement);

    statementId = (statement.id) ? statement.id : 'not-valid-id'
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  })


  it('Deve ser capaz de mostrar a operação de instrução do usuário', async () => {
    const response = await request(app)
      .get(`/api/v1/statements/${statementId}`)
      .set({
        Authorization: `Bearer ${token}`,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('user_id');
    expect(response.body.id).toBe(statementId);
  });

  it('Não deve ser capaz de mostrar a operação de instrução de um usuário inexistente', async () => {
    await usersRepository.delete(userId);

    const response = await request(app)
      .get(`/api/v1/statements/${statementId}`)
      .set({
        Authorization: `Bearer ${token}`,
      });

    expect(response.status).toBe(404);
  });

  it('Não deve ser capaz de mostrar a instrução de uma operação inexistente', async () => {
    await statementsRepository.delete(statementId);

    const response = await request(app)
      .get(`/api/v1/statements/${statementId}`)
      .set({
        Authorization: `Bearer ${token}`,
      });

    expect(response.status).toBe(404);
  });
})
