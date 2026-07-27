import { Agenda } from '@hokify/agenda';
import { ConfigService } from '@nestjs/config';
import { envEnums } from 'src/config/enums';

export const createAgendaInstance = async (configService: ConfigService) => {
  const agenda = new Agenda({
    db: {
      address: configService.get<string>('AGENDA_MONGO_DB_URI'),
      collection: `agendaJobs_${configService.get(envEnums.ENVIRONMENT)}`,
    },
    processEvery: '30 seconds',
    defaultConcurrency: 5,
    maxConcurrency: 20,
    defaultLockLifetime: 10000,
  });

  // Create recommended indexes

  return agenda;
};
