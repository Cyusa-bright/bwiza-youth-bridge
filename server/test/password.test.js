import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'

test('bcrypt stores a verifiable hash rather than a plain-text password', async () => {
  const password = 'a real password used only for this unit test'
  const hash = await bcrypt.hash(password, 4)
  assert.notEqual(hash, password)
  assert.match(hash, /^\$2[aby]\$/)
  assert.equal(await bcrypt.compare(password, hash), true)
  assert.equal(await bcrypt.compare('a different password', hash), false)
})
