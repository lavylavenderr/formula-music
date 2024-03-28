import { methods, Route, type ApiRequest, type ApiResponse } from '@sapphire/plugin-api';

export class IndexRoute extends Route {
	public constructor(context: Route.LoaderContext, options: Route.Options) {
		super(context, {
			...options,
			route: ''
		});
	}

	public [methods.GET](_request: ApiRequest, response: ApiResponse) {
		return response.json({ message: 'Welcome to the Formula Music API. Please select an endpoint.', success: true });
	}
}
