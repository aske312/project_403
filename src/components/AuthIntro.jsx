import projectSummaryMarkdown from "../../docks/project-summary.md?raw";

function parseProjectSummary(markdown) {
  const lines = markdown.split(/\r?\n/);
  const summary = {
    title: "",
    intro: [],
    sections: [],
  };
  let currentSection = null;
  let currentSubsection = null;

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    if (line.startsWith("# ")) {
      summary.title = line.replace(/^#\s+/, "");
      return;
    }

    if (line.startsWith("## ")) {
      currentSection = {
        title: line.replace(/^##\s+/, ""),
        subsections: [],
      };
      summary.sections.push(currentSection);
      currentSubsection = null;
      return;
    }

    if (line.startsWith("### ")) {
      if (!currentSection) return;
      currentSubsection = {
        title: line.replace(/^###\s+/, ""),
        items: [],
      };
      currentSection.subsections.push(currentSubsection);
      return;
    }

    if (line.startsWith("- ")) {
      if (!currentSection) return;
      if (!currentSubsection) {
        currentSubsection = {
          title: currentSection.title,
          items: [],
        };
        currentSection.subsections.push(currentSubsection);
      }
      currentSubsection.items.push(line.replace(/^-\s+/, ""));
      return;
    }

    if (!currentSection) {
      summary.intro.push(line);
    }
  });

  return {
    ...summary,
    intro: summary.intro.join(" "),
  };
}

const projectSummary = parseProjectSummary(projectSummaryMarkdown);

export default function AuthIntro({ t, projectName }) {
  return (
    <section className="intro-panel project-summary" aria-label={projectSummary.title || t.product}>
      <div className="summary-hero">
        <p className="eyebrow">{t.product}</p>
        <h1>{projectName}</h1>
        <p className="lead">{projectSummary.intro}</p>
      </div>

      <div className="summary-visual" aria-hidden="true">
        <div className="messenger-preview">
          <div className="messenger-preview-header">
            <span />
            <span />
            <span />
          </div>
          <div className="messenger-preview-thread">
            <span className="preview-bubble preview-bubble-peer" />
            <span className="preview-bubble preview-bubble-self" />
            <span className="preview-bubble preview-bubble-peer short" />
            <span className="preview-input" />
          </div>
        </div>

        <div className="summary-rhythm">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="summary-sections">
        {projectSummary.sections.map((section, sectionIndex) => (
          <article className="summary-section" key={section.title}>
            <div className="summary-section-heading">
              <span className="summary-section-index">{String(sectionIndex + 1).padStart(2, "0")}</span>
              <h2>{section.title}</h2>
            </div>

            <div className="summary-subsections">
              {section.subsections.map((subsection) => (
                <section className="summary-subsection" key={`${section.title}-${subsection.title}`}>
                  <h3>{subsection.title}</h3>
                  <ul>
                    {subsection.items.map((item) => (
                      <li key={`${subsection.title}-${item}`}>
                        <span className="summary-marker" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
