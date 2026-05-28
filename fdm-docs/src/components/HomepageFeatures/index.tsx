import Heading from "@theme/Heading"
import clsx from "clsx"
import { Database, GitMerge, Puzzle } from "lucide-react"
import styles from "./styles.module.css"

type FeatureItem = {
    title: string
    Svg: React.ComponentType<React.ComponentProps<"svg">>
    description: JSX.Element
}

const FeatureList: FeatureItem[] = [
    {
        title: "Standardized Schema",
        Svg: Database,
        description: (
            <>
                Based on the Asset-Action model, providing a consistent
                structure for diverse agricultural data.
            </>
        ),
    },
    {
        title: "Modular Packages",
        Svg: Puzzle,
        description: (
            <>
                Use <code>fdm-core</code> for core interactions,{" "}
                <code>fdm-data</code> for catalogues, and{" "}
                <code>fdm-calculator</code> for analysis – pick what you need.
            </>
        ),
    },
    {
        title: "Open & Extensible",
        Svg: GitMerge,
        description: (
            <>
                Open-source library built with TypeScript. Contribute new
                features, data sources, or calculations.
            </>
        ),
    },
]

function Feature({ title, Svg, description }: FeatureItem) {
    return (
        <div className={clsx("col col--4")}>
            <div className="text--center">
                <Svg className={styles.featureSvg} role="img" />
            </div>
            <div className="text--center padding-horiz--md">
                <Heading as="h3">{title}</Heading>
                <p>{description}</p>
            </div>
        </div>
    )
}

export default function HomepageFeatures(): JSX.Element {
    return (
        <section className={styles.features}>
            <div className="container">
                <div className="row">
                    {FeatureList.map((props) => (
                        <Feature key={props.title} {...props} />
                    ))}
                </div>
            </div>
        </section>
    )
}
