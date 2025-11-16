export type PipelineContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  pipeline: {
    stage: string;
    notes: string | null;
    updatedAt: string | null;
  };
  property: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
  } | null;
  stats: {
    appointments: number;
    quotes: number;
  };
  openTasks: number;
  jobSummary?: {
    quoteId: string;
    appointmentId: string | null;
    appointmentStatus: string | null;
    startAt: string | null;
    totalCents: number;
    paidCents: number;
    outstandingCents: number;
    lastPaymentAt: string | null;
    lastPaymentMethod: string | null;
  } | null;
  lastActivityAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type PipelineLane = {
  stage: string;
  contacts: PipelineContact[];
};

export type PipelineResponse = {
  stages: string[];
  lanes: PipelineLane[];
};
