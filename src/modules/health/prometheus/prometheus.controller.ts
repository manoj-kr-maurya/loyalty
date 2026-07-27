import { Controller } from '@nestjs/common';
import { PrometheusController as WillSotoPrometheusController } from '@willsoto/nestjs-prometheus';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Prometheus')
@Controller('metrics')
export class PrometheusController extends WillSotoPrometheusController {}
