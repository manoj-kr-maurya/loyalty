# Agenda Module

## Overview
The Agenda Module handles asynchronous job scheduling and processing for the loyalty platform. It uses MongoDB-backed Agenda job queue for reliable task scheduling, job retry logic, and distributed job processing.

## Current State (Implemented Features)

### Job Scheduling
- **Schedule Jobs**: Create jobs for delayed execution
- **Job Persistence**: Store jobs in MongoDB
- **Job Execution**: Process jobs at specified times
- **Recurring Jobs**: Support for repeat schedules (daily, weekly, etc.)

### Job Types Implemented
- **Campaign Expiry Reminders**: Notify before campaign ends
- **Wallet Auto-Expiry**: Expire points automatically
- **Order Processing**: Process pending orders
- **Notification Reminders**: Send reminder notifications
- **Report Generation**: Generate periodic reports

### Configuration
- **Agenda DB**: MongoDB connection for job persistence
- **Concurrency**: Configurable max concurrent jobs
- **Lock Interval**: Job lock duration to prevent duplicates
- **Grace Period**: Buffer before locking expired jobs

## Database Models Used
- MongoDB Collections:
  - `agendaJobs` - Job records
  - `jobs` - Job metadata

## Dependencies
- `Agenda` - Job queue library
- `MongoDB` - Job persistence
- `ConfigService` - Configuration
- `Logger` - Job logging
- `MailAndSmsService` - For notification jobs

## Current Implementation Details

### Job Structure
```typescript
{
  _id: ObjectId,
  name: string,              // Job type: e.g., "campaign-expiry-reminder"
  type: "normal" | "single", // One-time or recurring
  data: {                     // Job payload
    campaignId?: string,
    organizationId?: string,
    customerId?: string
  },
  priority: number,
  repeatAt?: Date,           // Next execution time
  repeatInterval?: string,   // e.g., "1 hour"
  lastRunAt?: Date,
  lastFinishedAt?: Date,
  failCount?: number,
  failedAt?: Date,
  unlockTime?: Date
}
```

### Job Definition Example
```typescript
// Define a job
agenda.define('campaign-expiry-reminder', async (job) => {
  const { campaignId } = job.attrs.data;
  // Send reminder to organization
});

// Schedule job
await agenda.schedule('in 5 days', 'campaign-expiry-reminder', {
  campaignId: 'CAMP123'
});
```

## What They Want to Build (Future Goals)

### Phase 1: Advanced Scheduling
- [ ] Cron-based scheduling
- [ ] Complex recurrence patterns
- [ ] Timezone-aware scheduling
- [ ] Pause/resume jobs
- [ ] Job priority queuing

### Phase 2: Job Monitoring
- [ ] Real-time job status dashboard
- [ ] Job execution metrics
- [ ] Failure tracking and alerts
- [ ] Retry history
- [ ] Performance analytics

### Phase 3: Error Handling
- [ ] Exponential backoff for retries
- [ ] Dead letter queue for failed jobs
- [ ] Error alerting
- [ ] Manual job replay
- [ ] Circuit breaker pattern

### Phase 4: Distribution
- [ ] Multi-instance job distribution
- [ ] Load balancing across workers
- [ ] Worker heartbeat monitoring
- [ ] Graceful shutdown
- [ ] Job affinity/routing

### Phase 5: Advanced Features
- [ ] Job dependencies (chaining)
- [ ] Conditional job execution
- [ ] Job cancellation
- [ ] Job progress tracking
- [ ] Webhook callbacks on completion

### Phase 6: Observability
- [ ] Job metrics export (Prometheus)
- [ ] Tracing integration
- [ ] Logging correlation
- [ ] Performance profiling
- [ ] Resource usage monitoring

## API Endpoints
```
GET    /admin/jobs                    - List all jobs
GET    /admin/jobs/:id               - Get job details
POST   /admin/jobs/:id/retry         - Retry failed job
DELETE /admin/jobs/:id               - Cancel job
GET    /admin/jobs/status            - Get worker status

GET    /admin/jobs/metrics           - Job execution metrics
POST   /admin/jobs/purge             - Clean up old jobs
```

## Job Types

### Campaign Expiry Reminder
```typescript
{
  name: "campaign-expiry-reminder",
  trigger: "5 days before campaign end",
  data: {
    campaignId: string,
    organizationId: string
  }
}
```

### Wallet Point Expiry
```typescript
{
  name: "wallet-point-expiry",
  trigger: "Daily at midnight",
  data: {
    customerId?: string  // If empty, process all
  }
}
```

### Order Reconciliation
```typescript
{
  name: "order-reconciliation",
  trigger: "Hourly",
  data: {
    organizationId?: string,
    batchSize: 100
  }
}
```

## Configuration

```env
# Agenda
AGENDA_MONGO_DB_URI=mongodb://localhost:27017/loyalty-jobs
AGENDA_MAX_CONCURRENCY=20
AGENDA_LOCK_INTERVAL=5000  # milliseconds
AGENDA_GRACE_PERIOD=10000  # milliseconds
```

## Error Handling
- `JobNotFoundException` - Job doesn't exist
- `JobExecutionFailedException` - Job execution error
- `AgendaConnectionException` - MongoDB connection error
- `InvalidJobConfigException` - Invalid job configuration

## Database Indexes
- Index on: name, nextRunTime (for finding next jobs)
- Index on: state, lockedAt (for locked jobs)
- Index on: failedAt (for retry queries)

## Best Practices

### Job Design
- Keep jobs idempotent (safe to retry)
- Store minimal data (reference IDs, not full objects)
- Set appropriate timeout values
- Handle partial failures gracefully

### Concurrency
- Adjust maxConcurrency based on CPU cores
- Monitor job queue length
- Scale horizontally if needed
- Use job priority for important tasks

### Monitoring
- Log all job executions
- Alert on failures
- Track job completion rate
- Monitor queue depth

## Integration Points
- **MongoDB**: Job persistence and locking
- **Notification Service**: For reminder jobs
- **Database Service**: For data processing jobs
- **Prometheus**: Metrics export

## Performance Considerations
- MongoDB connection pooling
- Batch processing for bulk operations
- Index optimization for job queries
- Async/await for non-blocking jobs
- Consider Redis for faster operations

## Scaling Considerations
- MongoDB replica set for high availability
- Multiple Agenda instances (workers)
- Load balancing jobs across instances
- Queue depth monitoring
- Graceful scaling up/down

## Notes
- Jobs stored in MongoDB, not Postgres
- Jobs are atomic/serialized execution
- Failed jobs can be retried with exponential backoff
- Requires MongoDB running for job queue
- Consider backup of job data
- Old jobs should be archived/purged periodically
