# horse_run_game

**말 달리자** — 11×11 보드에서 중앙 오아시스에 먼저 도달하는 2인 대전 보드게임

[![게임 시작](https://img.shields.io/badge/▶%20게임%20시작-지금%20플레이하기-22c55e?style=for-the-badge&logo=googlechrome&logoColor=white)](https://see-yoon.github.io/horse_run_game/)

> 위 **게임 시작** 버튼을 누르면 브라우저에서 바로 플레이할 수 있습니다.

## 게임 방법

- **목표**: 보드 중앙 (5, 5)에 먼저 도달하면 승리
- **턴**: 흑 / 백이 번갈아 한 말씩 이동
- **이동**
  - **미끄럼**: 상·하·좌·우로 벽이나 다른 말 직전까지 이동
  - **나이트**: 체스 나이트처럼 (2, 1) 점프 (보라색 구역에는 착지 불가)
- **모드**: 2인 대전 / VS AI (쉬움·보통·어려움)
- **기타**: BGM, 승리 후 복기 기능 지원

## 로컬에서 실행

```bash
git clone https://github.com/see-yoon/horse_run_game.git
cd horse_run_game/horse_run_game
# index.html 을 브라우저로 열기
```

## GitHub Pages (최초 1회)

README 버튼이 동작하려면 저장소에서 Pages를 켜야 합니다.

1. GitHub 저장소 → **Settings** → **Pages**
2. **Build and deployment** → Source: **GitHub Actions**
3. `main` 브랜치에 push하면 자동 배포됩니다

배포 주소: [https://see-yoon.github.io/horse_run_game/](https://see-yoon.github.io/horse_run_game/)
