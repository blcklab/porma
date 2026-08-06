import { signal, effect } from '../packages/porma/src/reactivity/index.js'

const count = signal(0)

effect(() => {
  console.log(count.value)
})

count.value++
