import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContentManager } from '../../content/ContentManager';
import { useGame } from '../context/GameContext';

export function RevealPage() {
  const navigate = useNavigate();
  const {
    currentRound,
    revealResponses,
    settings,
    players,
    judgeId,
    voteOrder,
    pickWinnerJudge,
    castVote
  } = useGame();

  const [currentVoteIndex, setCurrentVoteIndex] = useState(0);

  const judgeName = useMemo(() => players.find((p) => p.id === judgeId)?.name ?? '-', [players, judgeId]);

  if (!currentRound || !settings || !revealResponses.length) {
    return <div className="card">Aucune reponse a reveler.</div>;
  }

  const onPickJudge = async (responseId: string) => {
    await pickWinnerJudge(responseId);
    navigate('/scoreboard');
  };

  const onVote = async (responseId: string) => {
    const voterId = voteOrder[currentVoteIndex];
    const res = await castVote(voterId, responseId);
    if (res.done) navigate('/scoreboard');
    else setCurrentVoteIndex((i) => i + 1);
  };

  const currentVoterName = players.find((p) => p.id === voteOrder[currentVoteIndex])?.name;

  return (
    <section className="stack">
      <div className="card">
        <h2>Revelation anonyme</h2>
        <p>
          <strong>Sujet:</strong> {currentRound.subject.text}
        </p>
        <p>
          <strong>Template:</strong> {currentRound.template.text}
        </p>
        <p>
          <strong>Juge:</strong> {judgeName}
        </p>
        {settings.winMode === 'vote' && <p>Votant actuel: {currentVoterName}</p>}
      </div>

      <div className="grid-2">
        {revealResponses.map((r) => (
          <button
            key={r.id}
            className="card selectable"
            onClick={() =>
              settings.winMode === 'judge' ? onPickJudge(r.id) : onVote(r.id)
            }
          >
            <p>{ContentManager.fillTemplate(currentRound.template.text, r.answerRaw)}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
