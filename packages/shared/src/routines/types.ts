/**
 * Typed routine trigger contract. The host determines the owner and grants;
 * none of these user-facing fields authorize mailbox reads or external sends.
 * Weekdays are ISO-8601: Monday=1, Sunday=7.
 */
export type RoutineTrigger =
  | { kind: "interval"; everyMinutes: number; anchorAt: string }
  | { kind: "calendar"; cadence: "daily" | "weekly"; localTime: string; weekday: number | null; timeZone: string }
  | { kind: "once"; fireAt: string; timeZone: string }
  | { kind: "event"; eventType: string; conditions: Record<string, string>; debounceMinutes: 15 };

export type RoutineScheduleTrigger = Exclude<RoutineTrigger, { kind: "event" }>;

export type DigestWindow = "since_previous_occurrence" | "previous_24_hours" | "previous_local_day";

export type RoutineOccurrencePreview = {
  /** Fixed intended UTC instant; retrying must never recalculate this value. */
  fireAt: string;
  /** Local clock display without an invented zone conversion. */
  localTime: string;
  /** IANA zone actually used for the preview. */
  timeZone: string;
  /** Minutes east of UTC at the intended occurrence. */
  offsetMinutes: number;
};


/**
 * Preview-only routine data supplied by a user or a model.
 * This never includes a trusted actor, access grant, standing delivery consent,
 * executable job status or permission to send external communications.
 */
export type RoutineDestination =
  | { kind: "in_app" }
  | {
      kind: "whatsapp_digest";
      accountId: string;
      recipientId: string;
      deliveryPolicy: "text_in_window_template_outside" | "template_only";
      template: {
        providerId: string;
        name: string;
        language: string;
        contentHash: string;
        parameterSchemaHash: string;
      } | null;
    };

export type RoutineDraft = {
  name: string;
  mailboxIds: string[];
  trigger: RoutineTrigger;
  task: { kind: "email_digest"; language: string; window: DigestWindow };
  destination: RoutineDestination;
  limits: {
    maxCodePoints: number;
    emptyBehavior: "skip" | "check_in";
    catchUpMinutes: number;
  };
  quietHours: { start: string; end: string; timeZone: string } | null;
};

export type RoutineProposalPreview = {
  status: "preview_only";
  normalized: RoutineDraft;
  configHash: string;
  nextOccurrences: RoutineOccurrencePreview[];
  warnings: string[];
};
