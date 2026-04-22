import { createHash } from 'node:crypto';

import type { Archetype, ExamOutcome } from '@sharaga/contracts';

import { calculateLevel, type StoredProfile } from './profile.js';

export const EXAM_ID = 'weekly_exam';
export const EXAM_CAPACITIES = [3, 4, 5] as const;
export const EXAM_TITLE = 'Общий Экзамен';
export const EXAM_DESCRIPTION =
  'Соберите пати, проверьте готовность и вытяните общий экзамен. Смешанный состав играет заметно сильнее.';

export type StoredExamPartyMember = {
  userId: string;
  firstName: string;
  archetype: Archetype;
  joinedAt: Date;
  readyAt: Date | null;
  isOwner: boolean;
  isCurrentUser: boolean;
};

export type StoredExamParty = {
  id: string;
  ownerUserId: string;
  capacity: 3 | 4 | 5;
  status: 'queueing' | 'ready_check' | 'completed' | 'cancelled';
  memberCount: number;
  members: StoredExamPartyMember[];
  createdAt: Date;
  updatedAt: Date;
};

export type ExamRewardDelta = {
  userId: string;
  profileXp: number;
  archetypeXp: number;
  softCurrency: number;
  reputation: number;
};

export type ComputedExamOutcome = {
  successChancePct: number;
  rollPct: number;
  outcome: ExamOutcome;
  summary: string;
  rewards: ExamRewardDelta[];
};

export function getExamDefinition() {
  return {
    id: EXAM_ID,
    title: EXAM_TITLE,
    description: EXAM_DESCRIPTION,
    capacities: EXAM_CAPACITIES
  };
}

export function hashToRollPct(seed: string): number {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 8);
  return Number.parseInt(digest, 16) % 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getUniqueBonus(uniqueCount: number) {
  if (uniqueCount >= 3) return 30;
  if (uniqueCount === 2) return 15;
  return 0;
}

export function computeSuccessChancePct(archetypes: Archetype[], partySize: number): number {
  const uniqueCount = new Set(archetypes).size;
  const duplicateBonus = 3 * (partySize - uniqueCount);
  const sizeBonus = partySize === 5 ? 10 : partySize === 4 ? 5 : 0;

  let chance = 35 + getUniqueBonus(uniqueCount) + duplicateBonus + sizeBonus;
  if (archetypes.includes('botan')) chance += 12;
  if (archetypes.includes('sportsman')) chance += 10;
  if (archetypes.includes('partygoer')) chance += 8;

  return clamp(chance, 20, 90);
}

function buildSummary(archetypes: Archetype[], outcome: ExamOutcome): string {
  const uniqueCount = new Set(archetypes).size;
  const mixed = uniqueCount === 3;
  if (outcome === 'success') {
    return mixed
      ? 'Вы зашли тремя разными ролями, и комиссия не смогла вас расклеить.'
      : 'Команда собралась ровно и дожала экзамен без лишней суеты.';
  }

  return mixed
    ? 'Состав помог не развалиться, но до чистой победы чуть не дотянули.'
    : 'Экзамен вы кое-как вывезли, но однотипный состав чувствовался слишком сильно.';
}

export function computeExamOutcome(members: Array<{ userId: string; archetype: Archetype }>, seed: string): ComputedExamOutcome {
  const archetypes = members.map((member) => member.archetype);
  const successChancePct = computeSuccessChancePct(archetypes, members.length);
  const rollPct = hashToRollPct(seed);
  const outcome: ExamOutcome = rollPct < successChancePct ? 'success' : 'partial_failure';
  const partygoerBonus = archetypes.includes('partygoer') ? 1 : 0;
  const summary = buildSummary(archetypes, outcome);

  return {
    successChancePct,
    rollPct,
    outcome,
    summary,
    rewards: members.map((member) => ({
      userId: member.userId,
      profileXp: outcome === 'success' ? 4 : 2,
      archetypeXp: outcome === 'success' ? 2 : 1,
      softCurrency: (outcome === 'success' ? 3 : 1) + partygoerBonus,
      reputation: outcome === 'success' ? 2 : 0
    }))
  };
}

export function applyExamRewardToProfile(profile: StoredProfile, reward: Omit<ExamRewardDelta, 'userId'>, now: Date): StoredProfile {
  const nextProfileXp = profile.profileXp + reward.profileXp;

  return {
    ...profile,
    level: calculateLevel(nextProfileXp),
    profileXp: nextProfileXp,
    archetypeXp: profile.archetypeXp + reward.archetypeXp,
    softCurrency: profile.softCurrency + reward.softCurrency,
    reputation: profile.reputation + reward.reputation,
    updatedAt: now
  };
}
