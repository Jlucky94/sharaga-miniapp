import { z } from 'zod';

export const archetypes = ['botan', 'sportsman', 'partygoer'] as const;
export const actionIds = ['study_notes', 'train_hard', 'spark_the_campus', 'help_classmate'] as const;
export const projectKinds = ['notes', 'gym', 'festival'] as const;

export const archetypeSchema = z.enum(archetypes);
export const actionIdSchema = z.enum(actionIds);
export const projectKindSchema = z.enum(projectKinds);

export type Archetype = z.infer<typeof archetypeSchema>;
export type ActionId = z.infer<typeof actionIdSchema>;
export type ProjectKind = z.infer<typeof projectKindSchema>;

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
    label: 'Study Notes',
    description: 'Turn a messy lecture into notes classmates can actually use.',
    archetypeAffinity: 'botan',
    resultCopy: 'You turned scattered lecture notes into something classmates will thank you for later.'
  },
  train_hard: {
    id: 'train_hard',
    label: 'Train Hard',
    description: 'Build momentum and show up as the reliable one when it matters.',
    archetypeAffinity: 'sportsman',
    resultCopy: 'You pushed through a hard session and brought steady momentum back to campus.'
  },
  spark_the_campus: {
    id: 'spark_the_campus',
    label: 'Spark The Campus',
    description: 'Lift the mood and make it easier for people to gather around something fun.',
    archetypeAffinity: 'partygoer',
    resultCopy: 'You gave the campus a burst of energy and made people want to join in.'
  },
  help_classmate: {
    id: 'help_classmate',
    label: 'Help A Classmate',
    description: 'Step in fast and make someone else’s day less chaotic.',
    archetypeAffinity: null,
    resultCopy: 'You stepped in for a classmate and made the whole day feel lighter.'
  }
} as const satisfies Record<ActionId, ActionCatalogEntry>;

export const projectAffinity: Record<ProjectKind, Archetype> = {
  notes: 'botan',
  gym: 'sportsman',
  festival: 'partygoer'
} as const;

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

export const feedItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('contribution'),
    id: z.string().uuid(),
    userId: z.string().uuid(),
    userFirstName: z.string(),
    projectId: z.string().uuid(),
    projectTitle: z.string(),
    amount: z.number().int(),
    createdAt: z.string().datetime()
  }),
  z.object({
    kind: z.literal('unlock'),
    id: z.string().uuid(),
    userId: z.string().uuid(),
    userFirstName: z.string(),
    projectId: z.string().uuid(),
    projectTitle: z.string(),
    createdAt: z.string().datetime()
  }),
  z.object({
    kind: z.literal('benefit'),
    id: z.string().uuid(),
    userId: z.string().uuid(),
    userFirstName: z.string(),
    projectId: z.string().uuid(),
    projectTitle: z.string(),
    createdAt: z.string().datetime()
  }),
  z.object({
    kind: z.literal('like'),
    id: z.string().uuid(),
    userId: z.string().uuid(),
    userFirstName: z.string(),
    contributionId: z.string().uuid(),
    projectTitle: z.string(),
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
  nextCursor: z.string().datetime().nullable()
});

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
