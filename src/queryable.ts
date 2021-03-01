import deepEqual from "deep-equal";
import { IAssertQueryable } from './IAsertQueryable';
import { IQueryable, QueryableDefaultReturn } from './IQueryable';
import { IQueryableGroup } from './IQueryableGroup';
import {
    Predicate, PredeicateIndex, Selector,
    Sort, Reducer, Action, FreeFunc,
    Func
} from './signtures';
import { matchValues, randomNum, union } from './helpers';
import { InteractiveQuery } from './InteractiveQuery';
import clone from "clone";

/**
 * This is the std implementation of IQueryable
 * this class contains all implementations necesary to make queries
 * support generic type
 * Through this class you can make clean, extensible and advanced queries
 * using the interface IQueryable
 * @class
 * @description The basic query engine class to process result of the a query
 * @see
 * @access public
 * @argument T the query element T can be primitives value or object
 */
 export class Queryable<T> implements IQueryable<T>{

    /**
     * @access protected
     * @property {Iterable<T>} source
     * @description contains the source of the query
     */
    protected source: Iterable<T>;

    /**
     * @access private
     * @property {PredeicateIndex<T>[]}
     * @default {[]}
     * @description store the basic where filters
     */
    private whereClosures: PredeicateIndex<T>[] = [];

    /**
     * @access private
     * @property {PredeicateIndex<T>[]}
     * @default {[]}
     * @description store the selector fucntion that transform the query
     */
    private selectClosures!: Selector<T,any>;

    /**
     * @access private
     * @property {PredeicateIndex<T>[]}
     * @default {[]}
     */
    private ordersByValue: {sort:Func<T, any>, desc:boolean}[] = [];

    /**
     * @access private
     * @property {PredeicateIndex<T>[]}
     * @default {[]}
     */
    private orderByCoparision: Sort<T>[] = [];

    /**
     * @access private
     * @property {PredeicateIndex<T>[]}
     * @default {[]}
     * @description store the conditional where filters
     */
    private whereConditionClosures: {_con: boolean, _predi: PredeicateIndex<T>}[] = [];

    /**
     * @access private
     * @property {number}
     * @default {[]}
     * @description store the limit value
     */
    private limit = 0;

    /**
     * @access private
     * @property {number}
     * @default {[]}
     * @description store the offset value
     */
    private offset = 0;

    /**
     * @access private
     * @property {Predicate<T> | null} ruleSkip
     * @description store the predicate to evaluate the skip condition
     */
    private ruleSkip: Predicate<T> | null = null;

    /**
     * @access private
     * @property {Predicate<T> | null} ruleTake
     * @description store the predicate to evaluate the take condition
     */
    private ruleTake: Predicate<T> | null = null;

    /**
     * @constructor
     * @param {Iterable<T>} _source - this is the source to provide elements to query
     * @access public
     * @description allow recive the source to Queryable<T>
     */
    constructor(_source: Iterable<T>)
    {
        this.source = _source;
    }


    /**
     * @method create
     * @description help to create a new query fron this
     * @param  {(parent:Iterable<T>,next:(arg:K)=>void)=>void} func
     * @returns IQueryable
     */
    create<K>(func: (parent: Iterable<T>, next: (arg: K) => void) => void): IQueryable<K> {
        const storage: K[] = [];
        // this function must create a fork with parent iterator and hook fucntion
        // that register a new element in the array storage
        // then the array storage is the second source from new query forked
        func.call(null, this, element => storage.push(element));
        return new Queryable<K>(storage);
    }

    where(evaluate: Predicate<T>): IQueryable<T>;
    // tslint:disable-next-line: unified-signatures
    where(evaluate: PredeicateIndex<T>): IQueryable<T>;

    where(evaluate: any): IQueryable<T> {
        this.whereClosures.push(evaluate);
        return this;
    }

    except(evaluate: Predicate<T>): IQueryable<T>;
    // tslint:disable-next-line: unified-signatures
    except(evaluate: PredeicateIndex<T>): IQueryable<T>;

    /**
     * @param  {any} evaluate
     * @returns IQueryable
     */
    except(evaluate: any): IQueryable<T> {
        this.where((x: any,i=undefined) => !evaluate(x,i));
        return this;
    }

    /**
     * @param  {FreeFunc<T>} evaluate
     * @returns IQueryable
     */
    notNull(evaluate: FreeFunc<T>): IQueryable<T> {
        this.where((x: T) => evaluate(x) !== null);
        return this;
    }
    /**
     * @param  {FreeFunc<T>} evaluate
     * @returns IQueryable
     */
    isNull(evaluate: FreeFunc<T>): IQueryable<T> {
        this.where((x: T) => evaluate(x) === null);
        return this;
    }

    /**
     * @param  {Func<T} evaluate
     * @param  {} K>
     * @param  {Iterable<K>} range
     * @returns IQueryable
     */
    toBe<K>(evaluate: Func<T, K>, range: Iterable<K>): IQueryable<T> {
       this.where(x => Array.from(range).includes(evaluate(x)));
       return this;
    }

    /**
     * @param  {Func<T} evaluate
     * @param  {} K>
     * @param  {Iterable<K>} range
     * @returns IQueryable
     */
    toBeOut<K>(evaluate: Func<T, K>, range: Iterable<K>): IQueryable<T> {
        this.where(x => !Array.from(range).includes(evaluate(x)));
        return this;
     }

    /**
     * @param  {Func<T} evaluate
     * @param  {K} start
     * @param  {K} end
     * @param  {boolean} inclusive=true
     * @returns IQueryable
     */
    between<K = number | Date>(evaluate: Func<T, K>, start: K, end: K, inclusive = true): IQueryable<T> {
        this.where(x => {
            const data = evaluate(x);
            // tslint:disable-next-line: strict-comparisons
            return inclusive ? data >= start && end >= data : data > start && end > data ;
        });
        return this;
    }

    exact(element: T): QueryableDefaultReturn<T> {
        return this.where(x => deepEqual(element, x));
    }

    not(element: Partial<T>): QueryableDefaultReturn<T> {
       return this.where(x => !matchValues(x,element));
    }

    exlude(element: T): QueryableDefaultReturn<T> {
        return this.where(x => !deepEqual(element, x));
    }

    match(element: Partial<T>): IQueryable<T> {
       return this.where(x => matchValues(x,element));
    }

    distinct(func: FreeFunc<T>): IQueryable<T> {
        throw new Error('Method not implemented.');
    }

    join<TOuter, Result>(query: IQueryable<TOuter, QueryableDefaultReturn<TOuter>>, on: (inner?: T, outer?: TOuter) => boolean, result: (inner?: T, outer?: TOuter) => Result | null, behavior?: 'left' | 'right' | 'inner' | 'reset'): IQueryable<Result, QueryableDefaultReturn<Result>> {
        throw new Error('Method not implemented.');
    }

    export(): IQueryable<T> {
       return clone(this);
    }

    createWith<K>(filter: Predicate<T>, builder: (element: T, next: (arg: K) => void) => void): IQueryable<K, QueryableDefaultReturn<K>> {
        const parent = this;
        const iterableExec: Iterable<K> = {
            *[Symbol.iterator]() {
                let state: K|null = null;
                for (const current of parent) {
                   if(filter.call(null, current)){
                    builder(current, (arg) => state = arg);
                    if(state !== null){
                        yield state;
                        state = null;
                    }
                   }
                }
            }
        };
        return new Queryable<K>(iterableExec);
    }

    assertMode(): IAssertQueryable<T> {
        throw new Error('Method not implemented.');
    }

    contains(element: T): boolean;
    // tslint:disable-next-line: unified-signatures
    contains(predicate: Predicate<T>): boolean;

    contains(arg: any): boolean {
        // check the overload
        if(typeof arg === 'function'){
            for (const current of this) {
                return arg.call(null, current);
            }
            return false;
        }else{
            return false;
        }
    }

    single(predicate: Predicate<T>, _def?: T): T | null {
        for (const current of this) {
            if(predicate.call(null, current)){
                return current;
            }
        }
        return null;
    }

    random(): T|null {
        const max = this.count();
        if(max === 0){
            return null;
        }
        const limit = randomNum(0, max);
        const index = 0;
        for (const current of this) {
            // this loop determine that element is selected by random
            if(index >= limit){
                return current;
            }
        }
        return null;
    }

    ofType<K>(): IQueryable<K> {
        throw new Error('Method not implemented.');
    }

    whereIf(condition: boolean, evaluate: Predicate<T>): IQueryable<T>;
    // tslint:disable-next-line: unified-signatures
    whereIf(condition: boolean, evaluate: PredeicateIndex<T>): IQueryable<T>;

    whereIf(condition: any, evaluate: any): IQueryable<T> {
        this.whereConditionClosures.push({_con:condition, _predi:evaluate});
        return this;
    }

    select<K>(map: Selector<T, K>): IQueryable<K> {
        this.selectClosures = map;
        return new Queryable<K>(this as unknown as Iterable<K>);
    }

    concat(second: Iterable<T>): IQueryable<T> {
        // the concat method in this case is very simply to implement
        // but is possible improve and optimize
        return new Queryable<T>(union(this, second));
    }

    append(second: Iterable<T>): IQueryable<T> {
        // the concat method in this case is very simply to implement
        // but is possible improve and optimize
        return new Queryable<T>(union(second, this));
    }

    orderBy(func: Func<T, any>): IQueryable<T>;
    // tslint:disable-next-line: unified-signatures
    orderBy(func: Sort<T>): IQueryable<T>;

    orderBy(func: any): IQueryable<T> {
        if(typeof func !== 'function'){
            // to create a sort rule the func argument should be a function
            throw new TypeError('the order by functions should be callable');
        }

        const order = func as {lenght:number};

        if(order.lenght === 2){
            this.orderByCoparision.push(func);
        }else{
            this.ordersByValue.push({sort:func,desc: false});
        }
        return this;
    }

    orderByDescending(func: Func<T, any>): IQueryable<T>{
        this.ordersByValue.push({ sort:func, desc: true });
        return this;
    }

    groupBy<K>(_func: Func<T, any>): IQueryableGroup<K, T> {
        throw new Error('Method not implemented.');
    }

    reverse(): IQueryable<T> {
        // quick reverse by array method
        this.source = Array.from(this.applySorts(this.source)).reverse();
        return this;
    }

    agregate<K>(func: Reducer<T, K>, initial: K | null): K|null {
        let state = initial;
        for (const current of this) {
            // it's similar or alias of reduce method in array
           state = func.call(null, current, state as K);
        }
        return state;
    }

    any(): boolean {
        for (const _ of this) {
           return true;
        }
        return false;
    }

    all(): boolean {
        // this way allow know if all success filters
        return Array.from(this.source).length === this.count();
    }

    count(): number {
       let result = 0;
       for (const _ of this) {
           result++;
       }
       return result;
    }

    skip(count: number): IQueryable<T> {
        this.offset = count;
        return this;
    }

    skipWhile(skip: Predicate<T>): IQueryable<T> {
        this.ruleSkip = skip;
        return this;
    }

    take(count: number): IQueryable<T> {
        this.limit = count;
        return this;
    }

    takeWhile(takeCondition: Predicate<T>): IQueryable<T> {
      this.ruleTake = takeCondition;
      return this;
    }

    first(): T {
        for (const _ of this) {
            return _;
         }
         return null as unknown as T;
    }

    last(): T {
        let current: T|null = null;
        for (const _ of this) {
            // O(n) linear problem
            current = _;
         }
         return current as unknown as T;
    }

    toArray(): T[] {
       return Array.from(this);
    }

    toArrayColumn<K>(columnSelect: Func<T, K>): K[] {
       const storage: K[] = [];
       for (const data of this) {
           storage.push(columnSelect(data));
       }
       return storage;
    }

    toInteractive(): InteractiveQuery<T> {
        // create fron this iterator
        return new InteractiveQuery(this[Symbol.iterator]());
    }

    toSet(): Set<T> {
       return new Set(this);
    }

    toMap(mapper: (arg: T) => [string, T]): Map<string,T> {
        const map = new Map<string,T>();
        for (const current of this) {
           const [key,value] = mapper(current);
            map.set(key, value);
        }
        return map;
    }

    forEach(action: Action<T>): void {
        for (const current of this) {
            // simple invoke action
            action.call(null, current);
        }
    }

    poll(evaluator: (arg: T) => number, forMax = true): T|null {
        let result: T|null = null;
        let record: number = 0;
        let initial = true;
        for (const current of this) {
            const evluation = evaluator(current);
            if(initial){
                result = current;
                record = evluation;
                initial = false;
                continue;
            }
            if(forMax && evluation > record){
                result = current;
                record = evluation;
            }else if(!forMax && evluation < record){
                result = current;
                record = evluation;
            }
        }
        return result;
    }

    toJson(_idented?: boolean): string {
        return JSON.stringify(this.toArray())
    }

    /**
     * @method
     * @alias [Symbol.iterator]
     * @description the main query engine and proces of the source
     */
    * [Symbol.iterator](): Iterator<T, any, undefined> {
         // simples vars
         const hasSort = this.hasSortsRule();
         const hub: T[] = [];
         let skipped = 0;
         let takeElms = 0;

         // main iterator loop
         // this loop help use the source of the query as Iterable
         for (const current of this.source) {
             /**
              * @var {T} current
              * this loop create an iterator from source
              */

             // check limit and offset
             if((this.ruleTake !== null && !this.ruleTake?.call(null, current)) || (this.limit !== 0 && this.limit === takeElms)){
                 break;
             }

             if(this.ruleSkip !== null && this.ruleSkip?.call(null, current)){
                 continue;
             }
             else if(this.offset !== 0 && this.offset > skipped){
                 skipped++;
                 continue;
             }

             const pass = this.applyFilters(current);

             // check the pass and limit
             if(!pass){
                 continue;
             }else{
                 takeElms++;
             }

            if(hasSort){
                 // check if is transform
             if(this.selectClosures === undefined){
                    hub.push(current);
                }else{
                    // return a result transform by selet function
                    hub.push(this.selectClosures(current));
                }
            }else{
                 // check if is transform
             if(this.selectClosures === undefined){
                    yield current;
                }else{
                    // return a result transform by selet function
                    yield this.selectClosures(current);
                }
            }
        }

        // if is sorted
        if(hasSort && hub.length > 0){
            for (const data of this.applySorts(hub)) {
                yield data;
            }
        }
   }

    /**
     * @method hasSortsRule
     * @access private
     * @return true if this query provide some sort rule
     */
    private hasSortsRule(): boolean{
        // both array contains sort rule
        return this.orderByCoparision.length > 0 || this.ordersByValue.length > 0;
    }

    /**
     * @function applyFilters
     * @description invoke all where filters
     * @access private
     */
    private applyFilters(element: T): boolean{
        const filters = this.whereClosures.concat(
            // this is a good way to concat both rules to filter
            this.whereConditionClosures
            .filter(w => w._con)
            .map(w => w._predi)
        );

        // invoke the filter above current element
        for (let index = 0; index < filters.length; index++) {
            const where = filters[index];
            if(where(element, index)){
                // the element is included for this time
                continue;
            }else{
                // is out of the results
                return false;
            }
        }
        // pass filter and included in the results
        return true;
    }

    /**
     * @method
     * @param {Iterable<T>} current the elment to make a sort
     * @description The basic function to make sort on Iterable
     * @access private
     * @returns {Iterable<T>}
     */
    private applySorts(current: Iterable<T>): Iterable<T>{
        let sourceArray = Array.from(current);
        for (const sort of this.orderByCoparision) {
           sourceArray = sourceArray.sort(sort);
        }
        for (const rule of this.ordersByValue) {
            sourceArray = sourceArray.sort((arg1, agr2) =>{
                const result = rule.desc ? ((rule.sort(arg1) < rule.sort(agr2)) ? 1 : -1) :
                ((rule.sort(arg1) > rule.sort(agr2)) ? 1 : -1);

                return result;
            });
        }
        return sourceArray;
    }
}