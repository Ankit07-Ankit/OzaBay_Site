import { IMG } from "../../data/assets.js";
import { MAKER_STORIES } from "../../data/siteContent.js";
import Reveal from "../shared/Reveal.jsx";

export default function MakerStories(){
  return <section className="maker-stories oz-section">
    <div className="oz-container">
      <Reveal><div className="section-head maker-stories__head"><div><p className="eyebrow">The making / moving image</p><h2>Stories that <em>start with the hands.</em></h2></div><p>Meet the craft through motion — wheel, hammer, thread and grain. These films are representative workshop footage used to bring the craft story to life until OzaBay has its own commissioned maker films.</p></div></Reveal>
      <div className="maker-stories__rail">
        {MAKER_STORIES.map((story,i)=><article className="maker-story-card" key={story.id}>
          <div className="maker-story-card__media">
            <video src={story.video} autoPlay muted loop playsInline preload="metadata" poster={i===0?IMG.terracotta:i===1?IMG.blue:i===2?IMG.indigo:IMG.sculptural} onError={e=>{if(e.currentTarget.src!==story.fallback)e.currentTarget.src=story.fallback}} aria-label={`${story.craft} workshop footage`}/>
            <div className="maker-story-card__wash"/>
            <span className="maker-story-card__index">{story.chapter}</span>
            <span className="maker-story-card__sound"><i/> SOUND OFF · CINEMATIC LOOP</span>
          </div>
          <div className="maker-story-card__copy"><p>{story.craft} · {story.place}</p><h3>{story.maker}</h3><span>{story.story}</span><small>{story.source}</small></div>
        </article>)}
      </div>
    </div>
  </section>
}
