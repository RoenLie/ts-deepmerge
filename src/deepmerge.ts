import { DeepMergeTwoTypes, Fn, Rec } from './deepmerge.types';

function defaultIsMergeableObject( value: Rec ) {
	const isNonNullObject = ( value: Rec ) => !!value && typeof value === 'object';

	const isSpecial = ( value: Rec ) => {
		const stringValue = Object.prototype.toString.call( value );

		const canUseSymbol = typeof Symbol === 'function' && Symbol.for;
		const REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for( 'react.element' ) : 0xeac7;

		const isReactElement = ( value: Rec ) => value?.[ '$$typeof' ] === REACT_ELEMENT_TYPE;

		return stringValue === '[object RegExp]'
			|| stringValue === '[object Date]'
			|| isReactElement( value );
	};

	return isNonNullObject( value )
		&& !isSpecial( value );
}

/*  */

function cloneUnlessOtherwiseSpecified( value: Rec, options: DeepmergeOptions ) {
	const emptyTarget = ( val: any ) => Array.isArray( val ) ? [] : {};

	return ( options.clone !== false && options.isMergeableObject( value ) )
		? deepmerge( emptyTarget( value ), value, options )
		: value;
}

/*  */

function defaultArrayMerge<T extends any[], S extends any[]>(
	target: T,
	source: S,
	options: DeepmergeOptions,
) {
	return [ ...target, ...source ]
		.map( ( element ) => options.cloneUnlessOtherwiseSpecified( element, options ) );
}

/*  */

function mergeObject<T extends Rec, S extends Rec>(
	target: T,
	source: S,
	options: DeepmergeOptions,
) {
	const getMergeFunction = ( key: keyof any, options: DeepmergeOptions ) => {
		if ( !options.customMerge )
			return deepmerge;

		const customMerge = options.customMerge( key );

		return typeof customMerge === 'function' ? customMerge : deepmerge;
	};

	const propertyIsOnObject = ( object: Rec, property: keyof any ) => {
		try {
			return property in object;
		}
		catch ( _ ) {
			return false;
		}
	};

	// Protects from prototype poisoning and unexpected merging up the prototype chain.
	const propertyIsUnsafe = ( target: Rec, key: keyof any ) =>
		propertyIsOnObject( target, key ) // Properties are safe to merge if they don't exist in the target yet,
		&& !( Object.hasOwnProperty.call( target, key ) // unsafe if they exist up the prototype chain,
			&& Object.propertyIsEnumerable.call( target, key ) ); // and also unsafe if they're nonenumerable.

	const getEnumerableOwnPropertySymbols = ( target: Rec ) => Object.getOwnPropertySymbols
		? Object.getOwnPropertySymbols( target ).filter( ( symbol ) => target.propertyIsEnumerable( symbol ) )
		: [];

	const getKeys = ( target: Rec ) => [ ...Object.keys( target ), ...getEnumerableOwnPropertySymbols( target ) ];

	const dest: Rec = {};
	if ( options.isMergeableObject( target ) )
		getKeys( target ).forEach( ( key ) => dest[ key ] = cloneUnlessOtherwiseSpecified( target[ key ], options ) );

	getKeys( source ).forEach( ( key ) => {
		if ( propertyIsUnsafe( target, key ) )
			return;

		if ( propertyIsOnObject( target, key ) && options.isMergeableObject( source[ key ] ) )
			dest[ key ] = getMergeFunction( key, options )( target[ key ], source[ key ], options );
		else
			dest[ key ] = cloneUnlessOtherwiseSpecified( source[ key ], options );
	} );

	return dest;
}

/*  */

type DeepmergeOptions = {
	clone: boolean;
	arrayMerge: Fn;
	customMerge?: Fn;
	isMergeableObject: Fn;
	cloneUnlessOtherwiseSpecified: Fn;
};
type DeepMergePublicOptions = Partial<Pick<DeepmergeOptions, 'arrayMerge' | 'isMergeableObject' | 'clone'>>;


function deepmerge<T extends Rec, S extends Rec>(
	target: T,
	source: S,
	options: DeepMergePublicOptions = {} as any,
): DeepMergeTwoTypes<T, S> {
	const _options = options as DeepmergeOptions;
	_options.arrayMerge = _options.arrayMerge || defaultArrayMerge;
	_options.isMergeableObject = _options.isMergeableObject || defaultIsMergeableObject;
	_options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;
	_options.clone = _options.clone || false;

	const sourceIsArray = Array.isArray( source );
	const targetIsArray = Array.isArray( target );
	const sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;

	if ( !sourceAndTargetTypesMatch )
		return cloneUnlessOtherwiseSpecified( source, _options ) as DeepMergeTwoTypes<T, S>;
	else if ( sourceIsArray )
		return _options.arrayMerge( target, source, _options ) as DeepMergeTwoTypes<T, S>;
	else
		return mergeObject( target, source, _options ) as DeepMergeTwoTypes<T, S>;
}


deepmerge.all = <T>(
	array: T[],
	options?: DeepMergePublicOptions,
): T => {
	if ( !Array.isArray( array ) )
		throw new Error( 'first argument should be an array' );

	return array.reduce( ( prev, next ) => deepmerge( prev, next, options ), {} as Rec );
};


export { deepmerge };
