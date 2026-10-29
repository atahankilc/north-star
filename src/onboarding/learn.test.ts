import { describe, expect, it } from 'vitest'
import { driving } from '../agent/driving'
import { learn, onLearn, setLearnClock } from './learn'

describe('learn', () => {
  it('sends nothing while the agent drives the view', async () => {
    let t = 0
    setLearnClock(() => (t += 1000))
    const got: string[] = []
    const off = onLearn((e) => got.push(e.event))
    learn('focus-in', { kind: 'plane' })
    await driving(async () => learn('cards-multi', { count: 2 }))
    learn('card-selected', { kind: 'idea' })
    off()
    expect(got).toEqual(['focus-in'])
  })
})
