import type { MechanismState, PinballDocument } from '@/shared/document'

/**
 * 灯走一条自己的循环时间轴，和球的运动、命中无关。
 * 时间轴只认识“这一拍该亮哪一盏”，颜色不写回机关状态，
 * 因此奖励结束或闪灯结束后都能重新落回时间轴当前的位置。
 */
export const LAMP_BEAT_MS = 240
export const LAMP_BEATS = 6
export const LAMP_LOOP_MS = LAMP_BEAT_MS * LAMP_BEATS
export const HIT_FLASH_MS = 240

export type LampMode = 'attract' | 'reward'

const ATTRACT_TONES = ['#ffd56a', '#ff8b3d', '#fff6e8']
const REWARD_TONES = ['#ffe08a', '#ffd0dc', '#fff6e8']
const FLASH_COLOR = '#fff6e8'
const DIM_COLOR = '#7a3a2a'

/** 待发与游玩时走招揽拍；奖励期间整条时间轴换成奖励拍。 */
export function lampMode(doc: PinballDocument): LampMode {
  return doc.chain.bonusMs > 0 ? 'reward' : 'attract'
}

/** 当前拍号。暂停时 clockMs 不前进，所以这里停在原拍上。 */
export function lampBeat(doc: PinballDocument): number {
  return Math.floor(doc.lamps.clockMs / LAMP_BEAT_MS) % LAMP_BEATS
}

/**
 * 时间轴本身：每个灯位按拍号错开一格。
 * 招揽拍是一盏一盏轮着亮；奖励拍是两拍全亮、一拍追光交替。
 */
export function lampLit(doc: PinballDocument, index: number): boolean {
  const beat = lampBeat(doc)
  if (lampMode(doc) === 'reward') {
    return beat % 2 === 0 || (beat + index) % 3 === 0
  }
  return (beat + index) % 3 === 0
}

export function lampColor(doc: PinballDocument): string {
  const beat = lampBeat(doc)
  const tones = lampMode(doc) === 'reward' ? REWARD_TONES : ATTRACT_TONES
  return tones[beat % tones.length] ?? tones[0] ?? '#ffd56a'
}

/** 命中只是给一盏灯挂一段短暂闪灯，不覆盖时间轴。 */
export function flashMechanism(mechanism: MechanismState): void {
  mechanism.flashMs = HIT_FLASH_MS
}

export function lampFlashed(mechanism: MechanismState | undefined): boolean {
  return (mechanism?.flashMs ?? 0) > 0
}

/** 灯位的固定序号，用于把同一拍的灯错开。 */
export function lampIndexOf(doc: PinballDocument, id: string): number {
  return doc.mechanisms.findIndex((item) => item.id === id)
}

/**
 * 绘制时的最终颜色：闪灯期间用高亮，闪灯结束立刻回到
 * 时间轴此刻该有的颜色（clockMs 含暂停扣除后的位置）。
 */
export function lampGlow(doc: PinballDocument, mechanism: MechanismState | undefined, index: number): string {
  if (lampFlashed(mechanism)) return FLASH_COLOR
  return lampLit(doc, index) ? lampColor(doc) : DIM_COLOR
}

/**
 * 推进灯时间轴。只在未暂停、未结束时调用；
 * 使用游戏回合的 dt 而不是墙钟时间，所以继续后从停住的拍子接着走。
 */
export function tickLamps(doc: PinballDocument, dtMs: number): void {
  if (dtMs <= 0) return
  doc.lamps.clockMs = (doc.lamps.clockMs + dtMs) % LAMP_LOOP_MS
  for (const mechanism of doc.mechanisms) {
    if (mechanism.flashMs > 0) mechanism.flashMs = Math.max(0, mechanism.flashMs - dtMs)
  }
}
