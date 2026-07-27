export class ResponseDto<T> {
  constructor(status: string, statusCode: number, data: T) {
    this.status = status;
    this.statusCode = statusCode;
    this.data = data;
  }

  status: string;
  statusCode: number;
  data: T;
}
