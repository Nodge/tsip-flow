# @tsip/flow

## 0.2.0

### Minor Changes

- [#5](https://github.com/Nodge/tsip-flow/pull/5) [`f1beda4`](https://github.com/Nodge/tsip-flow/commit/f1beda4b2b190d432d910b6f3033d31df3adb672) Thanks [@Nodge](https://github.com/Nodge)! - - Integrate Flow spec compatibility tests.
  - Skip notifying subscribers when a mutable flow re-emits the current value.

## 0.1.1

### Patch Changes

- [#2](https://github.com/Nodge/tsip-flow/pull/2) [`25c6319`](https://github.com/Nodge/tsip-flow/commit/25c63195e4a814e26f10e58e24de76bcda908496) Thanks [@Nodge](https://github.com/Nodge)! - Fix TypeScript declaration file generation by enabling DTS resolution in tsup config. This removes the dependency on the `@tsip/types` package.

## 0.1.0

### Minor Changes

- [`5a827db`](https://github.com/Nodge/tsip-flow/commit/5a827db7e0db71fd76655faf9635c649c8e37a7b) Thanks [@Nodge](https://github.com/Nodge)! - Initial release of @tsip/flow - a TypeScript implementation of reactive flows based on the TypeScript Interface Proposals (TSIP).
