const fs = require("fs-extra")
import crypto from 'crypto'
import { asyncForEach } from "./utils"

import { ModuleWithInit } from "./types"

//Agility API stuff
import { agilityConfig, getSyncClient, prepIncrementalMode } from './agility.config'
import GlobalFooter from 'components/common/GlobalFooter'
import GlobalHeader from 'components/common/GlobalHeader'

import { getModule } from "components/agility-modules"


const securityKey = agilityConfig.securityKey
const channelName = agilityConfig.channelName
const languageCode = agilityConfig.languageCode
const isDevelopmentMode = process.env.NODE_ENV === "development"

interface AgilityPageProps  {
	sitemapNode?: any,
	page?: any,
	dynamicPageItem?: any,
	pageTemplateName?:string|null,
	globalHeaderProps?:any,
	globalFooterProps?:any,
	languageCode?:string|null,
	channelName?:string|null,
	isPreview?:boolean,
	isDevelopmentMode?:boolean,
	notFound?:boolean
}

const getAgilityPageProps = async ({ params, preview, locale }:any):Promise<AgilityPageProps> => {

	let path = '/';
	if (params) {
		//build path by iterating through slugs
		path = '';
		params.slug.map((slug: string) => {
			path += '/' + slug
		})
	}

	//determine if we've already done a full build yet
	const buildFilePath = `${process.cwd()}/.next/cache/agility/build.log`
	const isBuildComplete = fs.existsSync(buildFilePath)

	//TODO: use locale to determin LANGUAGECODE (pulled from config at this point...)

	//determine if we are in preview mode
	const isPreview:boolean = (preview || isDevelopmentMode);

	const agilitySyncClient = getSyncClient({
		isPreview: isPreview,
		isDevelopmentMode,
		isIncremental: isBuildComplete
	});

	if (! agilitySyncClient) {
		console.log("AgilityCMS => Sync client could not be accessed.")
		return {
			notFound: true
		};
	}

	if (preview || isBuildComplete) {
		//only do on-demand sync in next's preview mode or incremental build...
		console.log(`AgilityCMS => Sync On-demand ${isPreview ? "Preview" : "Live"} Mode`)

		await prepIncrementalMode()
		await agilitySyncClient.runSync();
	}

	//get sitemap
	const sitemap = await agilitySyncClient.store.getSitemap({ channelName, languageCode });

	if (sitemap === null) {
		console.warn("No sitemap found after sync.");
	}

	let pageInSitemap = sitemap[path];
	let page: any = null;
	let dynamicPageItem: any = null;

	if (path === '/') {
		let firstPagePathInSitemap = Object.keys(sitemap)[0];
		pageInSitemap = sitemap[firstPagePathInSitemap];
	}

	if (pageInSitemap) {
		//get the page
		page = await agilitySyncClient.store.getPage({
			pageID: pageInSitemap.pageID,
			languageCode: languageCode
		});

	} else {
		//Could not find page
		console.warn('page [' + path + '] not found in sitemap.');
		return handlePageNotFound();
	}

	if (!page) {
		console.warn('page [' + path + '] not found in getpage method.');
	}


	//if there is a dynamic page content id on this page, grab it...
	if (pageInSitemap.contentID > 0) {
		dynamicPageItem = await agilitySyncClient.store.getContentItem({
			contentID: pageInSitemap.contentID,
			languageCode: languageCode
		});
	}

	//resolve the page template
	const pageTemplateName = page.templateName.replace(/[^0-9a-zA-Z]/g, '');

	//resolve the modules per content zone
	await asyncForEach(Object.keys(page.zones), async (zoneName: string) => {

		let modules: { moduleName: string; item: any }[] = [];

		//grab the modules for this content zone
		const modulesForThisContentZone = page.zones[zoneName];

		//loop through the zone's modules
		await asyncForEach(modulesForThisContentZone, async (moduleItem: { module: string,  item: any }) => {

			//find the react component to use for the module
			const moduleComponent = getModule(moduleItem.module)

			if (moduleComponent && moduleComponent.getCustomInitialProps) {
				//resolve any additional data for the modules

				//we have some additional data in the module we'll need, execute that method now, so it can be included in SSG
				if (isDevelopmentMode) {
					console.log(`AgilityCMS => Fetching additional data via getCustomInitialProps for ${moduleItem.module}...`);
				}

				const moduleData = await moduleComponent.getCustomInitialProps({
					item: moduleItem.item,
					agility: agilitySyncClient.store,
					languageCode,
					channelName,
					pageInSitemap,
					dynamicPageItem
				});

				//if we have additional module data, then add it to the module props using 'customData'
				if (moduleData != null) {
					moduleItem.item.customData = moduleData;
				}
			}

			modules.push({
				moduleName: moduleItem.module,
				item: moduleItem.item,
			})
		})


		//store as dictionary
		page.zones[zoneName] = modules;

	})

	//resolve data for other shared components
	const globalHeaderProps = await GlobalHeader.getCustomInitialProps({ agility: agilitySyncClient.store, languageCode: languageCode, channelName: channelName });
	const globalFooterProps = await GlobalFooter.getCustomInitialProps({ agility: agilitySyncClient.store, languageCode: languageCode, channelName: channelName });

	return {
		sitemapNode: pageInSitemap,
		page,
		dynamicPageItem,
		pageTemplateName,
		globalHeaderProps,
		globalFooterProps,
		languageCode,
		channelName,
		isPreview,
		isDevelopmentMode
	}
}

const getAgilityPaths = async (preview:boolean|undefined) => {

	//determine if we are in preview mode
	const isPreview = isDevelopmentMode || preview;

	//determine if we've already done a full build yet
	const buildFilePath = `${process.cwd()}/.next/cache/agility/build.log`
	const isBuildComplete = fs.existsSync(buildFilePath)

	const agilitySyncClient = getSyncClient({
		isPreview,
		isDevelopmentMode,
		isIncremental: isBuildComplete
	});


	if (! agilitySyncClient) {
		console.log("AgilityCMS => Sync client could not be accessed.")
		return [];
	}

	const sitemapFlat = await agilitySyncClient.store.getSitemap({
		channelName,
		languageCode
	})



	if (!sitemapFlat) {
		console.warn("AgilityCMS => No Site map found.  Make sure your environment variables are setup correctly.")
		return []
	}



	//returns an array of paths as a string (i.e.  ['/home', '/posts'] )
	const paths = Object.keys(sitemapFlat)
		.filter(path => {
			const sitemapNode = sitemapFlat[path]
			return !sitemapNode.redirect
				&& !sitemapNode.isFolder
		})

	return paths
}


const validatePreview = async({ agilityPreviewKey, slug }: any) => {
	//Validate the preview key
	if (!agilityPreviewKey) {
		return {
			error: true,
			message: `Missing agilitypreviewkey.`
		}
	}

	//sanitize incoming key (replace spaces with '+')
	if (agilityPreviewKey.indexOf(` `) > -1) {
		agilityPreviewKey = agilityPreviewKey.split(` `).join(`+`);
	}

	//compare the preview key being used
	const correctPreviewKey = generatePreviewKey();

	if (agilityPreviewKey !== correctPreviewKey) {
		return {
			error: true,
			message: `Invalid agilitypreviewkey.`
			//message: `Invalid agilitypreviewkey. Incoming key is=${agilityPreviewKey} compared to=${correctPreviewKey}...`
		}
	}

	//return success
	return {
		error: false,
		message: null
	}

}

const generatePreviewKey =() => {
	//the string we want to encode
	const str = `-1_${securityKey}_Preview`;

	//build our byte array
	let data = [];
	for (var i = 0; i < str.length; ++i) {
		data.push(str.charCodeAt(i));
		data.push(0);
	}

	//convert byte array to buffer
	const strBuffer = Buffer.from(data);

	//encode it!
	const previewKey = crypto.createHash('sha512').update(strBuffer).digest('base64');
	return previewKey;
}

function handlePageNotFound() {
	return {
		notFound: true
	}
}

export {
	getAgilityPageProps,
	getAgilityPaths,
	validatePreview,
	generatePreviewKey
}

