import { IMG } from "../../data/assets.js";
import { MAKER_STORIES } from "../../data/siteContent.js";
import Reveal from "../shared/Reveal.jsx";
import LazyVideo from "../shared/LazyVideo.jsx";

const POSTERS = [IMG.terracotta, IMG.blue, IMG.indigo, IMG.sculptural];

export default function MakerStories() {
  return (
    <section className="maker-stories oz-section">
      <div className="oz-container">
        <Reveal>
          <div className="section-head maker-stories__head">
            <div>
              <p className="eyebrow">The making / moving image</p>
              <h2>Stories that <em>start with the hands.</em></h2>
            </div>
            <p>
              Meet the craft through motion — wheel, hammer, thread and grain.
              These films are representative workshop footage used to bring
              the craft story to life until OzaBay has its own commissioned maker films.
            </p>
          </div>
        </Reveal>
        <div className="maker-stories__rail">
          {MAKER_STORIES.map((story, index) => (
            <article className="maker-story-card" key={story.id}>
              <div className="maker-story-card__media">
                <LazyVideo
                  src={story.video}
                  poster={POSTERS[index]}
                  onError={(event) => {
                    if (event.currentTarget.src !== story.fallback) {
                      event.currentTarget.src = story.fallback;
                    }
                  }}
                  aria-label={`${story.craft} workshop footage`}
                />
                <div className="maker-story-card__wash" />
                <span className="maker-story-card__index">{story.chapter}</span>
                <span className="maker-story-card__sound"><i /> SOUND OFF · CINEMATIC LOOP</span>
              </div>
              <div className="maker-story-card__copy">
                <p>{story.craft} · {story.place}</p>
                <h3>{story.maker}</h3>
                <span>{story.story}</span>
                <small>{story.source}</small>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
