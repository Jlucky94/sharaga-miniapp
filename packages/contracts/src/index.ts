import { z } from 'zod';

export const archetypes = ['botan', 'sportsman', 'partygoer'] as const;
export const actionIds = ['study_notes', 'train_hard', 'spark_the_campus', 'help_classmate'] as const;
export const projectKinds = ['notes', 'gym', 'festival'] as const;
export const partyStatuses = ['queueing', 'ready_check', 'completed', 'cancelled'] as const;
export const examOutcomes = ['success', 'partial_failure'] as const;
export const partyCapacities = [3, 4, 5] as const;
export const feedOrigins = ['player', 'demo'] as const;

export const archetypeSchema = z.enum(archetypes);
export const actionIdSchema = z.enum(actionIds);
export const projectKindSchema = z.enum(projectKinds);
export const partyStatusSchema = z.enum(partyStatuses);
export const examOutcomeSchema = z.enum(examOutcomes);
export const feedOriginSchema = z.enum(feedOrigins);
export const partyCapacitySchema = z.union([
  z.literal(3),
  z.literal(4),
  z.literal(5)
]);

export type Archetype = z.infer<typeof archetypeSchema>;
export type ActionId = z.infer<typeof actionIdSchema>;
export type ProjectKind = z.infer<typeof projectKindSchema>;
export type PartyStatus = z.infer<typeof partyStatusSchema>;
export type ExamOutcome = z.infer<typeof examOutcomeSchema>;
export type FeedOrigin = z.infer<typeof feedOriginSchema>;
export type PartyCapacity = z.infer<typeof partyCapacitySchema>;

export type ActionCatalogEntry = {
  id: ActionId;
  label: string;
  description: string;
  archetypeAffinity: Archetype | null;
  resultCopy: string;
};

export const actionCatalog = {
  study_notes: {
    id: 'study_notes',
    label: 'Собрать конспект',
    description: 'Разгрести сумбур после пары и собрать конспект, который реально выручит своих.',
    archetypeAffinity: 'botan',
    resultCopy: 'Ты собрал внятный конспект, и теперь своим будет проще вывезти следующую пару.'
  },
  train_hard: {
    id: 'train_hard',
    label: 'Вкатиться в треню',
    description: 'Подзарядить форму и показать, что на тебя можно опереться, когда всем тяжело.',
    archetypeAffinity: 'sportsman',
    resultCopy: 'Ты хорошо вкатился в треню и вернул в общий движ немного тонуса.'
  },
  spark_the_campus: {
    id: 'spark_the_campus',
    label: 'Раскачать движ',
    description: 'Поднять вайб и сделать так, чтобы вокруг снова хотелось собраться.',
    archetypeAffinity: 'partygoer',
    resultCopy: 'Ты раскачал движ, и вокруг сразу стало больше энергии и желания вписаться.'
  },
  help_classmate: {
    id: 'help_classmate',
    label: 'Выручить своего',
    description: 'Быстро вписаться в чужой завал и сделать день кому-то чуть менее нервным.',
    archetypeAffinity: null,
    resultCopy: 'Ты выручил своего, и у человека день уже не выглядит таким тильтовым.'
  }
} as const satisfies Record<ActionId, ActionCatalogEntry>;

export const projectAffinity: Record<ProjectKind, Archetype> = {
  notes: 'botan',
  gym: 'sportsman',
  festival: 'partygoer'
} as const;

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  telegramId: z.number().int(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  languageCode: z.string().nullable(),
  photoUrl: z.string().nullable()
});

export const profileSnapshotSchema = z.object({
  userId: z.string().uuid(),
  archetype: archetypeSchema.nullable(),
  level: z.number().int().min(1),
  profileXp: z.number().int().min(0),
  archetypeXp: z.number().int().min(0),
  energy: z.number().int().min(0),
  softCurrency: z.number().int().min(0),
  reputation: z.number().int().nonnegative()
});

export const profileResponseSchema = z.object({
  user: publicUserSchema,
  profile: profileSnapshotSchema,
  writeAccessGranted: z.boolean(),
  serverTime: z.string().datetime(),
  nextEnergyAt: z.string().datetime().nullable()
});

export const selectArchetypeRequestSchema = z.object({
  archetype: archetypeSchema
});

export const selectArchetypeResponseSchema = profileResponseSchema;

export const actionResultSchema = z.object({
  actionId: actionIdSchema,
  text: z.string(),
  rewards: z.object({
    profileXp: z.number().int().min(0),
    archetypeXp: z.number().int().min(0),
    softCurrency: z.number().int().min(0)
  })
});

export const performActionRequestSchema = z.object({
  actionId: actionIdSchema
});

export const performActionResponseSchema = profileResponseSchema.extend({
  result: actionResultSchema
});

export const projectSchema = z.object({
  id: z.string().uuid(),
  kind: projectKindSchema,
  title: z.string(),
  description: z.string(),
  threshold: z.number().int().min(1),
  progress: z.number().int().min(0),
  unlocked: z.boolean(),
  affinity: archetypeSchema.nullable(),
  userContribution: z.number().int().min(0),
  userHasClaimed: z.boolean()
});

export const contributionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  actionId: z.string(),
  amount: z.number().int().min(1),
  requestId: z.string(),
  createdAt: z.string().datetime()
});

export const benefitClaimSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  unlockCycle: z.number().int().min(1),
  createdAt: z.string().datetime()
});

export const contributionLikeSchema = z.object({
  id: z.string().uuid(),
  contributionId: z.string().uuid(),
  fromUserId: z.string().uuid(),
  createdAt: z.string().datetime()
});

export const examRewardSchema = z.object({
  userId: z.string().uuid(),
  profileXp: z.number().int().min(0),
  archetypeXp: z.number().int().min(0),
  softCurrency: z.number().int().min(0),
  reputation: z.number().int().min(0)
});

export const examPartyMemberSchema = z.object({
  userId: z.string().uuid(),
  firstName: z.string(),
  archetype: archetypeSchema,
  joinedAt: z.string().datetime(),
  readyAt: z.string().datetime().nullable(),
  isOwner: z.boolean(),
  isCurrentUser: z.boolean()
});

export const examPartySchema = z.object({
  id: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  capacity: partyCapacitySchema,
  status: partyStatusSchema,
  memberCount: z.number().int().min(0),
  members: z.array(examPartyMemberSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const examRunResultSchema = z.object({
  id: z.string().uuid(),
  partyId: z.string().uuid(),
  resolvedByUserId: z.string().uuid(),
  successChancePct: z.number().int().min(0).max(100),
  rollPct: z.number().int().min(0).max(99),
  outcome: examOutcomeSchema,
  summary: z.string(),
  rewards: z.array(examRewardSchema),
  resolvedAt: z.string().datetime()
});

export const examStateSchema = z.object({
  exam: z.object({
    id: z.literal('weekly_exam'),
    title: z.string(),
    description: z.string(),
    capacities: z.tuple([z.literal(3), z.literal(4), z.literal(5)])
  }),
  party: examPartySchema.nullable(),
  latestRun: examRunResultSchema.nullable()
});

export const queueForExamRequestSchema = z.object({
  capacity: partyCapacitySchema
});

export const queueForExamResponseSchema = z.object({
  party: examPartySchema
});

export const setPartyReadyRequestSchema = z.object({
  ready: z.boolean()
});

export const setPartyReadyResponseSchema = z.object({
  party: examPartySchema.nullable(),
  run: examRunResultSchema.nullable()
});

export const leavePartyResponseSchema = z.object({
  party: examPartySchema.nullable()
});

export const setWriteAccessRequestSchema = z.object({
  granted: z.boolean()
});

export const setWriteAccessResponseSchema = z.object({
  writeAccessGranted: z.boolean()
});

export const feedItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('contribution'),
    id: z.string().uuid(),
    userId: z.string().uuid(),
    userFirstName: z.string(),
    projectId: z.string().uuid(),
    projectTitle: z.string(),
    amount: z.number().int(),
    origin: feedOriginSchema,
    createdAt: z.string().datetime()
  }),
  z.object({
    kind: z.literal('unlock'),
    id: z.string().uuid(),
    userId: z.string().uuid(),
    userFirstName: z.string(),
    projectId: z.string().uuid(),
    projectTitle: z.string(),
    origin: feedOriginSchema,
    createdAt: z.string().datetime()
  }),
  z.object({
    kind: z.literal('benefit'),
    id: z.string().uuid(),
    userId: z.string().uuid(),
    userFirstName: z.string(),
    projectId: z.string().uuid(),
    projectTitle: z.string(),
    origin: feedOriginSchema,
    createdAt: z.string().datetime()
  }),
  z.object({
    kind: z.literal('like'),
    id: z.string().uuid(),
    userId: z.string().uuid(),
    userFirstName: z.string(),
    contributionId: z.string().uuid(),
    projectTitle: z.string(),
    origin: feedOriginSchema,
    createdAt: z.string().datetime()
  }),
  z.object({
    kind: z.literal('exam_result'),
    id: z.string().uuid(),
    examRunId: z.string().uuid(),
    partyId: z.string().uuid(),
    ownerFirstName: z.string(),
    memberFirstNames: z.array(z.string()).min(1),
    outcome: examOutcomeSchema,
    summary: z.string(),
    origin: feedOriginSchema,
    createdAt: z.string().datetime()
  })
]);

export const contributeRequestSchema = z.object({
  requestId: z.string().uuid(),
  amount: z.number().int().min(1).max(1)
});

export const contributeResponseSchema = z.object({
  profile: z.lazy(() => profileSnapshotSchema),
  project: projectSchema,
  contribution: contributionSchema,
  unlocked: z.boolean()
});

export const claimBenefitResponseSchema = z.object({
  profile: z.lazy(() => profileSnapshotSchema),
  claim: benefitClaimSchema
});

export const likeResponseSchema = z.object({
  like: contributionLikeSchema
});

export const listProjectsResponseSchema = z.object({
  projects: z.array(projectSchema)
});

export const feedResponseSchema = z.object({
  items: z.array(feedItemSchema),
  nextCursor: z.string().nullable()
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional()
});

export type PublicUser = z.infer<typeof publicUserSchema>;
export type ProfileSnapshot = z.infer<typeof profileSnapshotSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type SelectArchetypeRequest = z.infer<typeof selectArchetypeRequestSchema>;
export type SelectArchetypeResponse = z.infer<typeof selectArchetypeResponseSchema>;
export type PerformActionRequest = z.infer<typeof performActionRequestSchema>;
export type PerformActionResponse = z.infer<typeof performActionResponseSchema>;
export type ActionResult = z.infer<typeof actionResultSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Contribution = z.infer<typeof contributionSchema>;
export type BenefitClaim = z.infer<typeof benefitClaimSchema>;
export type ContributionLike = z.infer<typeof contributionLikeSchema>;
export type FeedItem = z.infer<typeof feedItemSchema>;
export type ContributeRequest = z.infer<typeof contributeRequestSchema>;
export type ContributeResponse = z.infer<typeof contributeResponseSchema>;
export type ClaimBenefitResponse = z.infer<typeof claimBenefitResponseSchema>;
export type LikeResponse = z.infer<typeof likeResponseSchema>;
export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;
export type FeedResponse = z.infer<typeof feedResponseSchema>;
export type ExamReward = z.infer<typeof examRewardSchema>;
export type ExamPartyMember = z.infer<typeof examPartyMemberSchema>;
export type ExamParty = z.infer<typeof examPartySchema>;
export type ExamRunResult = z.infer<typeof examRunResultSchema>;
export type ExamState = z.infer<typeof examStateSchema>;
export type QueueForExamRequest = z.infer<typeof queueForExamRequestSchema>;
export type QueueForExamResponse = z.infer<typeof queueForExamResponseSchema>;
export type SetPartyReadyRequest = z.infer<typeof setPartyReadyRequestSchema>;
export type SetPartyReadyResponse = z.infer<typeof setPartyReadyResponseSchema>;
export type LeavePartyResponse = z.infer<typeof leavePartyResponseSchema>;
export type SetWriteAccessRequest = z.infer<typeof setWriteAccessRequestSchema>;
export type SetWriteAccessResponse = z.infer<typeof setWriteAccessResponseSchema>;
