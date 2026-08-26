import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('Organization OTP Flow', () => {
    it('POST /organization/otp/phone - should send OTP', () => {
      return request(app.getHttpServer())
        .post('/organization/otp/phone')
        .send({
          countryCode: '91',
          phoneNumber: '9876543210',
          name: 'Test Org',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeDefined();
        });
    });

    it('POST /organization/otp/phone - should fail without phone', () => {
      return request(app.getHttpServer())
        .post('/organization/otp/phone')
        .send({
          countryCode: '91',
        })
        .expect(400);
    });
  });

  describe('Customer OTP Flow', () => {
    it('POST /customer/otp/phone - should send OTP', () => {
      return request(app.getHttpServer())
        .post('/customer/otp/phone')
        .send({
          countryCode: '91',
          phoneNumber: '9876543211',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeDefined();
        });
    });
  });
});
