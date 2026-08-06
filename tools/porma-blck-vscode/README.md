# Porma BLCK

VS Code support for Porma `.blck` components.

## Features

- Syntax highlighting for component blocks
- TypeScript highlighting in `<logic lang="ts">`
- Porma directive and event highlighting
- Snippets for common component patterns

## Example

```blck
<logic>
import { signal } from '@blcklab/porma'

const count = signal(0)
</logic>

<view>
  <button on.click={() => count.value++}>Count: {count}</button>
</view>
```
