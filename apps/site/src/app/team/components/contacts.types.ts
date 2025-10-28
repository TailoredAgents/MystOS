export type PropertySummary = {
  id: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  createdAt: string;
};

export type TaskSummary = {
  id: string;
  title: string;
  dueAt: string | null;
  assignedTo: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PipelineSummary = {
  stage: string;
  notes: string | null;
  updatedAt: string | null;
};

export type ContactSummary = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phoneE164: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  pipeline: PipelineSummary;
  properties: PropertySummary[];
  tasks: TaskSummary[];
  stats: {
    appointments: number;
    quotes: number;
  };
};

export type PaginationInfo = {
  limit: number;
  offset: number;
  total: number;
  nextOffset: number | null;
};
