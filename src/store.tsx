import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { Difficulty } from './theme';
import { Template, templates as baseTemplates } from './data/templates';
import { fromISO, toISO, todayISO } from './dates';

export type Child = {
  id: string;
  name: string;
  avatar: string;
  gender?: 'kız' | 'erkek';
  birthday?: string; // ISO
};

export type Parent = { id: string; nickname: string; name: string; avatar: string };

export type Assignment = { childId: string; difficulty: Difficulty; coins: number };

export type Task = {
  id: string;
  title: string;
  emoji: string;
  skill: string;
  description: string;
  assignments: Assignment[];
  startDate: string;
  recurring: boolean; // true: her gün tekrar eder
  endDate?: string;
  reminder?: string; // HH:MM
  requiresReview: boolean;
};

export type CompletionStatus = 'pending' | 'approved';
// anahtar: `${taskId}|${childId}|${date}`
export type Completions = Record<string, CompletionStatus>;

export type Message = { id: string; childId: string; text: string; at: string };

export type InviteCode = { code: string; createdAt: string };

type Store = {
  parent: Parent;
  children: Child[];
  tasks: Task[];
  completions: Completions;
  messages: Message[];
  savedIds: string[];
  customTemplates: Template[];
  inviteCodes: InviteCode[];
  addChild: (c: Omit<Child, 'id'>) => void;
  updateParent: (p: Partial<Parent>) => void;
  addTasks: (t: Omit<Task, 'id'>[]) => void;
  updateTask: (id: string, patch: Partial<Task>) => void; // tekrarlayan görevde tek kayıt => tüm günlere yansır
  deleteTask: (id: string) => void;
  toggleCompletion: (task: Task, childId: string, date: string) => void;
  review: (key: string, approve: boolean) => void;
  toggleSaved: (templateId: string) => void;
  addCustomTemplate: (t: Omit<Template, 'id' | 'usedBy' | 'custom'>) => string;
  allTemplates: Template[];
  sendMessage: (childId: string, text: string) => void;
  createInviteCode: () => string;
};

const Ctx = createContext<Store | null>(null);
let seq = 100;
const uid = (p: string) => `${p}${++seq}`;

export const completionKey = (taskId: string, childId: string, date: string) =>
  `${taskId}|${childId}|${date}`;

export const taskOccursOn = (task: Task, date: string) => {
  if (date < task.startDate) return false;
  if (!task.recurring) return date === task.startDate;
  return !task.endDate || date <= task.endDate;
};

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const makeCode = () =>
  Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export function StoreProvider({ children: kids }: { children: React.ReactNode }) {
  const [parent, setParent] = useState<Parent>({ id: 'p1', nickname: 'Ben', name: 'Ben', avatar: 'erkek' });
  const [children, setChildren] = useState<Child[]>([
    { id: 'c1', name: 'Nazlı', avatar: 'flamingo', gender: 'kız' },
    { id: 'c2', name: 'Arven', avatar: 'keçi', gender: 'erkek' },
  ]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Completions>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>(['t1']);
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);

  const addChild = useCallback((c: Omit<Child, 'id'>) => setChildren((p) => [...p, { ...c, id: uid('c') }]), []);
  const updateParent = useCallback((p: Partial<Parent>) => setParent((x) => ({ ...x, ...p })), []);
  const addTasks = useCallback(
    (t: Omit<Task, 'id'>[]) => setTasks((p) => [...p, ...t.map((x) => ({ ...x, id: uid('k') }))]),
    [],
  );
  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => setTasks((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [],
  );
  const deleteTask = useCallback((id: string) => setTasks((p) => p.filter((t) => t.id !== id)), []);

  const toggleCompletion = useCallback((task: Task, childId: string, date: string) => {
    const key = completionKey(task.id, childId, date);
    setCompletions((p) => {
      const n = { ...p };
      if (n[key]) delete n[key];
      else n[key] = task.requiresReview ? 'pending' : 'approved';
      return n;
    });
  }, []);

  const review = useCallback((key: string, approve: boolean) => {
    setCompletions((p) => {
      const n = { ...p };
      if (approve) n[key] = 'approved';
      else delete n[key];
      return n;
    });
  }, []);

  const toggleSaved = useCallback(
    (id: string) => setSavedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    [],
  );

  const addCustomTemplate = useCallback((t: Omit<Template, 'id' | 'usedBy' | 'custom'>) => {
    const id = uid('u');
    setCustomTemplates((p) => [...p, { ...t, id, usedBy: 0, custom: true }]);
    setSavedIds((p) => [...p, id]);
    return id;
  }, []);

  const sendMessage = useCallback(
    (childId: string, text: string) =>
      setMessages((p) => [...p, { id: uid('m'), childId, text, at: new Date().toISOString() }]),
    [],
  );

  const createInviteCode = useCallback(() => {
    const code = makeCode();
    setInviteCodes((p) => [...p, { code, createdAt: new Date().toISOString() }]);
    return code;
  }, []);

  const allTemplates = useMemo(() => [...customTemplates, ...baseTemplates], [customTemplates]);

  const value: Store = {
    parent, children, tasks, completions, messages, savedIds, customTemplates, inviteCodes,
    addChild, updateParent, addTasks, updateTask, deleteTask, toggleCompletion, review,
    toggleSaved, addCustomTemplate, allTemplates, sendMessage, createInviteCode,
  };
  return <Ctx.Provider value={value}>{kids}</Ctx.Provider>;
}

export const useStore = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider eksik');
  return v;
};

export { fromISO, toISO, todayISO };
