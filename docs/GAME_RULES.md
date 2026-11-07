# Trivia Battle: Game Rules & Features

This is the reference for how the game behaves. If code and this file disagree, this file wins until it is deliberately changed.

Each rule is marked by where it came from:

- **[Owner]**: specified by the game owner.
- **[Confirmed]**: a gap in the spec that the owner decided.
- **[Assumed]**: a gap filled by a default that the owner has not reviewed yet. See [Assumptions to review](#assumptions-to-review).

## 1. Overview

A 2-8 player online football trivia game played on a Catan-style hexagon map. Players or teams fight trivia rounds, and winners capture the losers' hexagons.

- **Win:** one player or team controls every hexagon. [Owner]
- **Elimination:** a player or team with no hexagons is out instantly, except for a team's last stand (section 11). [Owner]

## 2. Terms

| Term | Meaning |
|---|---|
| **Round** | One battle between 2 players: 5 questions, plus sudden death if tied. [Owner] |
| **Wave** | The set of rounds played at the same time. The next wave waits for all of them to finish. |
| **Set** | A group of 5 questions used for one round. [Owner] |
| **Death question** | A single question from the separate pool used only in sudden death. [Owner] |
| **Side** | The owner of hexagons: a player in solo mode, a team in teams mode. |
| **Cost** | The number of hexagons the loser of a round gives to the winner. |

## 3. Rooms and lobby

- The host creates a room and joins it, then sends the room code to the other players. [Owner]
- Room codes are 6 characters. [Owner] They use letters and digits that are hard to confuse, with no `0/O` or `1/I`. [Assumed]
- A room holds 2-8 players. [Owner]
- Joining players set a username first. [Owner] Usernames are 2-16 characters and unique within the room. [Assumed]
- In the lobby, players mark themselves ready, and switch teams in teams mode. [Owner]
- There are 8 hexagon colors. Each player or team has its own, chosen in the lobby, and no two can share one. [Owner]
  - Everyone gets a free color automatically on joining and can change it. [Assumed]
  - In teams mode, any member can change the team's color. [Assumed]
- The host starts the game once everyone else is ready and the settings are valid. The host presses Start rather than voting ready. [Assumed]
- Changing a setting clears everyone's ready vote, because the game they agreed to has changed. [Assumed]
- If the host leaves the lobby, host passes to the next player who joined. [Assumed]
- A player who drops out of the lobby keeps their place for 3 minutes, so the host can switch apps to share the code. [Assumed]
- Nobody can join a game in progress, except a returning player reconnecting. [Assumed]

## 4. Host settings

Only the host can change these, in the lobby's settings tab. [Owner]

| Setting | Default | Allowed | Source |
|---|---|---|---|
| Game mode | Solo | Solo, Teams | [Owner] |
| Number of teams | 2 | 2, 3 or 4 | [Owner] |
| Starting hexagons per player | 3 | Minimum 3, maximum 8 | Minimum [Owner], maximum [Assumed] |
| Time per question | 10 s | Minimum 10 s, maximum 30 s | Minimum [Owner], maximum [Assumed] |
| Rounds per player before cost increases | 5 | 1-20 | Default [Owner], range [Assumed] |
| Time between waves | 30 s | 30 s or 5 min | [Owner] |

## 5. Map (rules 1 and 2)

- Map size = number of players x starting hexagons per player. 4 solo players at 3 each gives 12 hexagons. [Owner]
- Every hexagon starts owned, so there are no neutral hexagons. [Assumed]
- **Teams:** hexagons are shared by the team. A team's minimum is its member count x 3, so a team of 4 starts with at least 12. [Owner]
- The host's setting is per player, and a team's total is its member count x that setting. Uneven teams therefore start uneven: at 3 per player, a 3v2 game starts 9 v 6. [Assumed]
- The map is one connected compact shape, and each side starts with its hexagons grouped together. [Assumed]

## 6. Teams mode (rules 2, 5 and 9)

- There can be 2, 3 or 4 teams. [Owner]
- Each team has a minimum of 2 and a maximum of 4 players, or the game cannot start. [Owner]
- Valid examples: 2v2v2v2, 2v2v2, 4v4, 3v2. [Owner]
- Teams need at least 4, 6 or 8 players for 2, 3 or 4 teams, which follows from the minimum team size.
- Teammates never face each other. [Owner]
- After the game starts, one random player from each team names the team. They have 60 seconds to confirm, otherwise a random name is used. [Owner]
- The 10-second start timer begins once all teams are named. [Assumed]

## 7. Match flow

1. **Team naming**, up to 60 s, in teams mode only. [Owner]
2. **Start timer**, 10 s. [Owner]
3. **Wave:** all rounds are played at the same time. Players who finish wait for the others. [Owner]
4. **Results:** captures are applied and animated on the map at the end of the wave. [Assumed]
5. **Break**, 30 s by default or 5 min if the host chose it, then the next wave. The host can start the next wave early at any point in the break. [Owner] Steps 4 and 5 share this time. [Assumed]
   - A leaderboard shows during the break, ranking every player by questions answered correctly, with fewer wrong answers breaking ties. [Owner for the ranking, Assumed for the tie-break]
6. Repeat from step 3 until one side owns every hexagon. [Owner]
7. **Finish screen:** shows the winner and player stats: most correct answers, most questions answered, most land won and most wrong answers. Tied players share a stat, and a stat nobody earned is hidden. [Owner for the stats, Assumed for ties]

How stats are counted: [Assumed]

- Sudden death questions count towards all answer stats.
- A question not answered in time counts as wrong, and not as answered.
- Land won is the hexagons a player captured by winning rounds. A saved last stand and a walkover after everyone leaves don't add to it.

## 8. Who plays whom (rules 3 and 4)

- Pairings are random. [Owner]
- After playing someone, a player cannot face them again until they have played all their other available opponents. [Owner]
- In teams mode, the same rule applies across all opposing team members. [Owner]
- A player's history clears once they have played everyone available to them. Eliminated players no longer count. [Assumed]
- Each wave has as many rounds as the rule allows, and the scheduler looks ahead so an early pairing does not cause avoidable sit-outs later. [Assumed]
- **Sitting out:** odd player counts and uneven teams mean someone sits out some waves. The player who has played the fewest rounds plays first, so sit-outs rotate. Sitting out earns nothing and costs nothing. [Assumed]
- If no legal round exists at all, histories clear and pairing runs again. [Assumed]

## 9. A round (rules 6 and 10)

- A round has 5 questions, each with 4 options and exactly 1 correct answer. [Owner]
- Each correct answer is worth 1 point. [Owner]
- Each question has a time limit, 10 s by default. [Owner]
- **Synced play:** both players get the same question at the same time. It reveals and moves on when both have answered or the timer ends. [Confirmed]
- No answer in time counts as wrong. [Assumed]
- All 5 questions are always played, even if the result is already decided. [Assumed]
- Answer speed does not affect the score. [Assumed]
- The higher score after 5 questions wins. [Owner]

**Sudden death**, on a tied score, including 0-0: [Owner]

- Death questions are shown one at a time.
- One player right and the other wrong ends the round.
- Both right or both wrong moves on to another death question.

## 10. Question pools (rule 6)

- **Standard pool:** at least 1000-1500 questions in sets of 5, so 200-300 sets. [Owner]
- **Death pool:** at least 200 questions. [Owner]
- **Language:** all questions and answers are in Arabic. [Owner]
- **Period:** topics are from 1950 to 2024, nothing earlier or later. [Owner] General questions about the laws of the game count as timeless. [Assumed]
- A round gets a random set. No two rounds in progress can use the same set. [Owner]
- A player never plays the same set twice in one game. [Owner]
- Death questions follow the same two limits. [Assumed]
- If the pool ever runs out, the least recently used questions are reused so the game cannot get stuck. [Assumed]
- Correct answers stay on the server and reach players only at the reveal, so they cannot be read from the browser. [Assumed]

## 11. Capturing and escalation (rule 7)

- The winner's side takes hexagons from the loser's side. [Owner]
- **Which hexagons:** chosen automatically, preferring those bordering the winner's land, otherwise random. [Confirmed]
- **Cost:** starts at 1, rises to 2 after 5 rounds per player, and to 3 after a further 5. [Owner]
- **Counting:** 5 rounds per player means 5 waves. With 8 players that is 5 waves of 4 battles, or 20 battles. [Confirmed]
- The cost stops at 3. [Assumed]
- Sit-outs and eliminations do not slow the count. With 3 players, cost still rises after 5 waves, though each player has played fewer than 5 rounds. [Assumed]
- If the loser has fewer hexagons than the cost, the winner takes what is left. [Assumed]
- In teams mode, results are applied in the order rounds finished. [Assumed]

**Last stand** (teams mode only):

- A team that hits 0 hexagons while a teammate's round is still being played is not eliminated yet. Its last hexagon is put on hold. [Owner]
- If a teammate still playing wins, the team survives on 1 hexagon. [Owner]
- That hexagon is the one on hold, so the capture of it is cancelled. The saving win captures nothing else, but still earns 1 credit. [Assumed]
- If no teammate still playing wins, the hexagon goes to the team that took it, and the team is eliminated when its last round finishes. [Assumed]
- If that team was itself eliminated during the wave, the hexagon goes to the team that eliminated it. [Assumed]
- After a save, the team's later results that wave apply normally. Another win captures as usual, and another loss can put the team back on hold. [Assumed]
- A team with no rounds still being played has no last stand. Teammates sitting out the wave do not count. [Assumed]

## 12. Credits and store (rule 11)

- Winning a round grants 1 credit. [Owner]
- Credits are spent in the store on items and powerups. [Owner]
- **This phase:** the credit balance, store screen and purchase system only. The owner will specify items, usage and costs later. [Owner]
- Credits belong to each player, including in teams mode. [Assumed]
- Credits last for one game. [Assumed]
- The store is open while waiting, during the break between waves, and while eliminated players spectate. [Assumed]

## 13. Connection problems [Assumed]

- A disconnected player can return to their seat automatically using a saved token. This matters on phones, where switching apps often drops the connection.
- While disconnected, a player's questions count as unanswered and the game does not wait for them.
- After 60 s away, a player counts as having left. Their rounds are instant losses without sudden death, so nobody waits on them, and their hexagons get captured normally.
- If only one side still has anyone in the game, that side wins immediately and takes the whole map.

## Assumptions to review

Everything marked [Assumed] above is open to change. These have the biggest effect on how the game feels:

1. Uneven teams start with uneven hexagons (section 5).
2. A player with no legal opponent sits out rather than repeating an opponent (section 8).
3. All 5 questions are played even after the result is decided (section 9).
4. Answer speed never affects the score (section 9).
5. Credits are per player and reset each game (section 12).
6. Players who leave stay on the map and lose instantly until captured (section 13).
