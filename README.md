# 09. Building & Using Custom Actions

---

# Initial Workflow

1. `lint`

2. `test` - `build`

---

## Types of Custom Actions

- Composite Action

- JavaScript Action

- Docker Action

---

## Composite Actions

1. Custom Composite Action을 분리하기 위한 별도의 파일을 만들어 정의해 봅니다. - [`3dd1e249`](https://github.com/seongjin2427/09.custom-actions/commit/3dd1e24963cebccf502841ef1ed4683ff66bcd85)

- Process
  - `./.github/actions/ached-deps/action.yml`
    - `actions` 폴더 명은 원하는 대로 지정할 수 있지만, 일반적으로 `actions`로 지정합니다.
    - `cached-deps` 폴더 명은 Custom Action의 이름이 됩니다.
    - `action.yml` 파일명은 반드시 `action`으로 지정되어야 합니다.
    - ```yml
        name: "Get & Cache Dependencies"
        # 커스텀 액션은 on 키를 지정하지 않습니다.
        # 마켓플레이스에 퍼블리쉬되면 보일 설명입니다.
        description: "Get the dependencies and (via npm) cache them."
        runs:
          using: "composite"
          steps:
            # deploy.yml 파일에서 분리할 Step을 붙여넣습니다.
            - name: Cache dependencies
              id: cache
              # uses 키를 사용할 때는 별도의 키를 추가하지 않아도 됩니다.
              uses: actions/cache@v3
              with:
                path: node_modules
                key: deps-node-modules-${{ hashFiles('**/package-lock.json') }}
            # 여전히 작성된 모든 키를 지원하기 때문에 유지 가능합니다.
            - name: Install dependencies
              # 아래 조건문도 여전히 동일하게 수행되어야 하기 때문에 변경사항이 없습니다.
              if: steps.cache.outputs.cache-hit != 'true'
              run: npm ci
              # 커스텀 composite action에서 run을 실행할 때, 반드시 shell 키를 포함해야 합니다.
              shell: bash

  - Custom Composite Action을 `deploy.yml` 파일에 적용해 봅니다.
    - `./.github/workflows/deploy.yml`
    - ```yml
      name: Deployment
        on:
          push:
            branches:
              - main
        jobs:
          lint:
            runs-on: ubuntu-latest
            steps:
              - name: Get code
                uses: actions/checkout@v3
              - name: Load & cache dependencies
                # 독립 레포지토리로 커스텀 액션을 분리하게 되면
                # 단순히 레포지토리 식별자를 기입하면 됩니다. ex) uses: seongjin2427/my-action
                # 지금은 동일 프로젝트 내의 커스텀 액션이기 때문에, 루트 폴더 기준 경로를 작성합니다.
                # GitHub Actions가 자동적으로 action.yml을 바라보기 때문에 기입하지 않습니다.
                uses: ./.github/actions/cached-deps
              - name: Lint code
                run: npm run lint
              ...

- Result
  - `./.github/actions/cached-deps/action.yml`로 분리하여 정의한 Custom Action이 정상적으로 동작하는 것을 확인할 수 있습니다.

2. 다른 Job들에서 중복되는 Step들도 교체합니다. - 

- Process
  - `./.github/workflows/deploy.yml`
  - ```yml
    ...
        # Composite Action으로 교체
        - name: Load & cache dependencies
          uses: ./.github/actions/cached-deps
        - name: Test code
          id: run-tests
          run: npm run test
        ...

        build:
          needs: test
          runs-on: ubuntu-latest
          steps:
            - name: Get code
              uses: actions/checkout@v3
              # Composite Action으로 교체
            - name: Load & cache dependencies
              uses: ./.github/actions/cached-deps
            - name: Build website
              run: npm run build
            ...

- Result
  -             