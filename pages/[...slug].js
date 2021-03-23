import Layout from "components/common/Layout";

import { getAgilityPageProps, getAgilityPaths } from "@agility/nextjs/node";
import { handlePreview } from "@agility/nextjs";
import { getModule } from "components/agility-modules";
import SiteHeader from "components/common/SiteHeader";
import SiteFooter from "components/common/SiteFooter";
import LoadingWidget from "components/common/LoadingWidget";

export async function getStaticProps({
  preview,
  params,
  locale,
  defaultLocale,
  locales,
}) {
  const globalComponents = {
    header: SiteHeader,
    footer: SiteFooter,
  };

  const agilityProps = await getAgilityPageProps({
    preview,
    params,
    locale,
    getModule,
    defaultLocale,
    globalComponents,
  });

  let rebuildFrequency = 10;

  if (!agilityProps) {
    // We throw to make sure this fails at build time as this is never expected to happen
    throw new Error(`Page not found`);
  }

  return {
    props: agilityProps,
    revalidate: rebuildFrequency,
  };
}

export async function getStaticPaths({ locales, defaultLocale }) {
  //get the paths configured in agility
  let agilityPaths = await getAgilityPaths({
    preview: false,
    locales,
    defaultLocale,
  });

  return {
    paths: agilityPaths,
    fallback: true,
  };
}

const AgilityPage = (props) => {
  if (handlePreview()) {
    return (
      <div className="relative flex flex-col justify-center items-center h-screen">
        <LoadingWidget message="Activating preview mode..." />
      </div>
    );
  }

  return <Layout {...props} />;
};

export default AgilityPage;
