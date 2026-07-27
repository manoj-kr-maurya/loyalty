const SuccessStatus = {
  Success: 'Success',
} as const;

const ErrorStatus = {
  Failure: 'Failure',
} as const;

export const CallStatuses = {
  ...SuccessStatus,
  ...ErrorStatus,
};

// Type derived from the combined object
export type CallStatuses = (typeof CallStatuses)[keyof typeof CallStatuses];
