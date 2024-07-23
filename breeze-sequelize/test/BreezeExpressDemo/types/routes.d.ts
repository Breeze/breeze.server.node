import { NextFunction, Request, Response } from 'express';
export type OpenObj = {
    [k: string]: any;
};
export declare function getMetadata(req: Request, res: Response, next: NextFunction): void;
export declare function get(req: Request, res: Response, next: NextFunction): void;
export declare function saveChanges(req: Request, res: Response, next: NextFunction): void;
export declare const namedQuery: OpenObj;
