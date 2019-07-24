// import * as zxteam from "@zxteam/contract";
// import { loggerManager } from "@zxteam/logger";
// import * as ajvModule from "ajv";
// import { Ajv, ErrorObject } from "ajv";
// import * as fs from "fs";
// import * as path from "path";
// import * as util from "util";
// import * as _ from "lodash";

// const readFile = util.promisify(fs.readFile);

// export class JsonSchemaError extends Error { }

// export class JsonSchemaValidationError extends JsonSchemaError {
// 	private readonly _errors: Array<Error>;

// 	public constructor(message: string, errors?: Array<Error>) {
// 		super(message);
// 		this._errors = errors || [];
// 	}

// 	get errors() { return this._errors; }
// }

// export class AjvWrapError extends JsonSchemaError {
// 	private _wrap: ajvModule.ErrorObject;

// 	public constructor(wrap: ErrorObject) {
// 		super(wrap.message);
// 		this._wrap = wrap;
// 	}

// 	public get wrap(): ErrorObject { return this._wrap; }
// }

// export class JsonSchemaLoadingError extends JsonSchemaError {
// 	public readonly innerError?: Error;

// 	public constructor(message: string, innerError?: Error) {
// 		if (innerError) {
// 			super(`${message} ${innerError.message}`);
// 			this.innerError = innerError;
// 		} else {
// 			super(message);
// 		}
// 	}
// }

// export class ArgumentError extends Error implements zxteam.ArgumentError {
// 	public readonly name = "ArgumentError";
// }

// export interface JsonSchemaManager {
// 	validate(schemaId: string, data: any): void;
// 	validateWithDefaults<T = any>(schemaId: string, data: T): T;
// }

// export async function factory(schemaRootDir: string, logger?: zxteam.Logger): Promise<JsonSchemaManager> {
// 	if (logger === undefined) {
// 		logger = loggerManager.getLogger("JsonSchemaManager");
// 	}

// 	const schemas = await internal.loadSchemas(schemaRootDir, logger);
// 	const { ajv, ajvDefaults } = internal.parseSchemas(schemas, schemaRootDir);

// 	function validate(schemaId: string, data: any): void {
// 		const res = ajv.validate(schemaId, data);
// 		if (res !== true) {
// 			const { errors } = ajv;
// 			if (_.isArray(errors) && errors.length > 0) {
// 				const message = errors[0].message || "Unknown validation error";
// 				throw new JsonSchemaValidationError(message, errors.map(ajvErrObj => new AjvWrapError(ajvErrObj)));
// 			}
// 			throw new JsonSchemaValidationError("Unknown validation error");
// 		}
// 	}

// 	function validateWithDefaults<T = any>(schemaId: string, data: T): T {
// 		const deepCopyData = internal.deepClone(data);
// 		const res = ajvDefaults.validate(schemaId, deepCopyData);
// 		if (res !== true) {
// 			const { errors } = ajvDefaults;
// 			if (_.isArray(errors) && errors.length > 0) {
// 				const message = errors[0].message || "Unknown validation error";
// 				throw new JsonSchemaValidationError(message, errors.map(ajvErrObj => new AjvWrapError(ajvErrObj)));
// 			}
// 			throw new JsonSchemaValidationError("Unknown validation error");
// 		}
// 		return deepCopyData;
// 	}

// 	const manager: JsonSchemaManager = {
// 		validate,
// 		validateWithDefaults
// 	};

// 	return manager;
// }

// export default factory;

// namespace internal {
// 	// export interface SchemasMap {
// 	// 	[schemaId: string]: ValidateFunction;
// 	// }

// 	export type SchemaTuple = [/*schemaId: */string, /*schemaJsonData: */any];

// 	export async function loadSchemas(dir: string, logger: zxteam.Logger): Promise<Array<SchemaTuple>> {
// 		let results: Array<[string, any]> = [];

// 		const files = fs.readdirSync(dir);
// 		const totalFiles = files.length;

// 		for (let fileIndex = 0; fileIndex < totalFiles; fileIndex += 1) {
// 			const schemaPath = path.join(dir, files[fileIndex]);
// 			const stat = fs.statSync(schemaPath);
// 			if (stat && stat.isDirectory()) {
// 				results = results.concat(await loadSchemas(schemaPath, logger));
// 			} else {
// 				const schemaBuffer = await readFile(schemaPath);
// 				let schema;
// 				try {
// 					schema = JSON.parse(schemaBuffer.toString());
// 					logger.debug(`Loaded schema ${schemaPath}`);
// 				} catch (e) {
// 					schema = {};
// 					logger.debug(`Skipped schema ${schemaPath}`);
// 				}
// 				results.push([schemaPath, schema]);
// 			}
// 		}

// 		logger.debug(`Loaded ${results.length} schemas.`);
// 		return results;
// 	}

// 	export function parseSchemas(schemasArray: Array<internal.SchemaTuple>, schemasDir: string): {
// 		ajv: Ajv;
// 		ajvDefaults: Ajv;
// 		//schemas: internal.SchemasMap;
// 	} {
// 		const ajv = new ajvModule({ allErrors: true, jsonPointers: true, verbose: true });
// 		const ajvDefaults = new ajvModule({ allErrors: true, jsonPointers: true, useDefaults: true });

// 		function parseRef(ref: string) {
// 			let refPath: string = ref;
// 			let refDefinition: string = "";
// 			const sharpIndex = refPath.indexOf("#");
// 			if (sharpIndex !== -1) {
// 				// sharp # symbol a flag for link to definitions
// 				refDefinition = refPath.substr(sharpIndex);
// 				refPath = refPath.substr(0, sharpIndex);
// 			}
// 			return [refPath, refDefinition];
// 		}

// 		const fileToIdMap: { [schemaRelativePath: string]: string } = {};
// 		//const schemaMap: { [schemaId: string]: };
// 		schemasArray.forEach(schemaTuple => {
// 			const schemaPath = schemaTuple[0];
// 			const schemaData = schemaTuple[1];
// 			const schemaRelativePath = path.relative(schemasDir, schemaPath);
// 			fileToIdMap[`./${schemaRelativePath}`] = schemaData.$id;
// 		});
// 		schemasArray.forEach(schemaTuple => {
// 			const schemaPath = schemaTuple[0];
// 			const schemaData = schemaTuple[1];
// 			const schemaDir = path.dirname(schemaPath);
// 			function refUpdateWalker(obj: any) {
// 				Object.keys(obj).forEach(key => {
// 					if (key === "$ref") {
// 						const ref = obj.$ref as string;
// 						if (ref.startsWith("#")) { return; }
// 						const [refPath, refDefinition] = parseRef(ref);
// 						const schemaRelativePath = path.relative(schemasDir, path.join(schemaDir, refPath));
// 						const relatedSchemaId = fileToIdMap[`./${schemaRelativePath}`];
// 						if (!relatedSchemaId) {
// 							throw new Error(`Could not find schemaId for schema ${refPath}`);
// 						}
// 						obj.$ref = `${relatedSchemaId}${refDefinition}`;
// 					} else {
// 						const value = obj[key];
// 						if (value && typeof value === "object") {
// 							refUpdateWalker(value);
// 						}
// 					}
// 				});
// 			}
// 			refUpdateWalker(schemaData);
// 			try {
// 				ajv.addSchema(schemaData);
// 				ajvDefaults.addSchema(schemaData);
// 			} catch (e) {
// 				throw new JsonSchemaLoadingError(`Could not add schema ${schemaPath} to Ajv:`, e);
// 			}
// 		});
// 		return {
// 			ajv,
// 			ajvDefaults
// 		};
// 	}

// 	export function deepClone<T>(value: T): T {
// 		if (_.isBuffer(value)) {
// 			return value;
// 		}
// 		if (_.isArray(value)) {
// 			const cloned: Array<any> = [];
// 			for (let i = 0; i < value.length; i++) {
// 				cloned.push(deepClone(value[i]));
// 			}
// 			return cloned as unknown as T;
// 		}
// 		if (_.isObject(value)) {
// 			// Retrieve the property names defined on object
// 			const propNames = Object.getOwnPropertyNames(value);

// 			// Clone properties
// 			const cloned: any = {};
// 			propNames.forEach(name => {
// 				const childValue = (value as any)[name];
// 				cloned[name] = deepClone(childValue);
// 			});
// 			return cloned;
// 		}
// 		return value;
// 	}
// }
