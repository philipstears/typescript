﻿//﻿
// Copyright (c) Microsoft Corporation.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

///<reference path='typescript.ts' />

module TypeScript {
    export function lastOf(items: any[]): any {
        return (items === null || items.length === 0) ? null : items[items.length - 1];
    }

    export function max(a: number, b: number): number {
        return a >= b ? a : b;
    }

    export function min(a: number, b: number): number {
        return a <= b ? a : b;
    }

    //
    // Helper class representing a path from a root ast node to a (grand)child ast node.
    // This is helpful as our tree don't have parents.
    //
    export class AstPath {
        public asts: AST[] = [];
        public top: number = -1;

        static reverseIndexOf(items: any[], index: number): any {
            return (items === null || items.length <= index) ? null : items[items.length - index - 1];
        }

        public clone(): AstPath {
            var clone = new AstPath();
            clone.asts = this.asts.map((value) => { return value; });
            clone.top = this.top;
            return clone;
        }

        public pop(): TypeScript.AST {
            var head = this.ast();
            this.up();

            while (this.asts.length > this.count()) {
                this.asts.pop();
            }
            return head;
        }

        public push(ast: TypeScript.AST) {
            while (this.asts.length > this.count()) {
                this.asts.pop();
            }
            this.top = this.asts.length;
            this.asts.push(ast);
        }

        public up() {
            if (this.top <= -1)
                throw new Error("Invalid call to 'up'");
            this.top--;
        }

        public down() {
            if (this.top === this.ast.length - 1)
                throw new Error("Invalid call to 'down'");
            this.top++;
        }

        public nodeType(): TypeScript.NodeType {
            if (this.ast() === null)
                return TypeScript.NodeType.None;
            return this.ast().nodeType;
        }

        public ast() {
            return <TypeScript.AST>AstPath.reverseIndexOf(this.asts, this.asts.length - (this.top + 1));
        }

        public parent() {
            return <TypeScript.AST>AstPath.reverseIndexOf(this.asts, this.asts.length - this.top);
        }

        public count() {
            return this.top + 1;
        }

        public get(index: number): TypeScript.AST {
            return this.asts[index];
        }

        public isNameOfClass(): bool {
            if (this.ast() === null || this.parent() === null)
                return false;

            return (this.ast().nodeType === TypeScript.NodeType.Name) &&
                (this.parent().nodeType === TypeScript.NodeType.ClassDeclaration) &&
                ((<TypeScript.InterfaceDeclaration>this.parent()).name === this.ast());
        }

        public isNameOfInterface(): bool {
            if (this.ast() === null || this.parent() === null)
                return false;

            return (this.ast().nodeType === TypeScript.NodeType.Name) &&
                (this.parent().nodeType === TypeScript.NodeType.InterfaceDeclaration) &&
                ((<TypeScript.InterfaceDeclaration>this.parent()).name === this.ast());
        }

        public isNameOfArgument(): bool {
            if (this.ast() === null || this.parent() === null)
                return false;

            return (this.ast().nodeType === TypeScript.NodeType.Name) &&
                (this.parent().nodeType === TypeScript.NodeType.ArgDecl) &&
                ((<TypeScript.ArgDecl>this.parent()).id === this.ast());
        }

        public isNameOfVariable(): bool {
            if (this.ast() === null || this.parent() === null)
                return false;

            return (this.ast().nodeType === TypeScript.NodeType.Name) &&
                (this.parent().nodeType === TypeScript.NodeType.VarDecl) &&
                ((<TypeScript.VarDecl>this.parent()).id === this.ast());
        }

        public isNameOfModule(): bool {
            if (this.ast() === null || this.parent() === null)
                return false;

            return (this.ast().nodeType === TypeScript.NodeType.Name) &&
                (this.parent().nodeType === TypeScript.NodeType.ModuleDeclaration) &&
                ((<TypeScript.ModuleDeclaration>this.parent()).name === this.ast());
        }

        public isNameOfFunction(): bool {
            if (this.ast() === null || this.parent() === null)
                return false;

            return (this.ast().nodeType === TypeScript.NodeType.Name) &&
                (this.parent().nodeType === TypeScript.NodeType.FunctionDeclaration) &&
                ((<TypeScript.FunctionDeclaration>this.parent()).name === this.ast());
        }

        public isChildOfScript(): bool {
            var ast = lastOf(this.asts);
            return this.count() >= 3 &&
                this.asts[this.top] === ast &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.List &&
                this.asts[this.top - 2].nodeType === TypeScript.NodeType.Script;
        }

        public isChildOfModule(): bool {
            var ast = lastOf(this.asts);
            return this.count() >= 3 &&
                this.asts[this.top] === ast &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.List &&
                this.asts[this.top - 2].nodeType === TypeScript.NodeType.ModuleDeclaration;
        }

        public isChildOfClass(): bool {
            var ast = lastOf(this.asts);
            return this.count() >= 3 &&
                this.asts[this.top] === ast &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.List &&
                this.asts[this.top - 2].nodeType === TypeScript.NodeType.ClassDeclaration;
        }

        public isArgumentOfClassConstructor(): bool {
            var ast = lastOf(this.asts);
            return this.count() >= 5 &&
                this.asts[this.top] === ast &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.List &&
                this.asts[this.top - 2].nodeType === TypeScript.NodeType.FunctionDeclaration &&
                this.asts[this.top - 3].nodeType === TypeScript.NodeType.List &&
                this.asts[this.top - 4].nodeType === TypeScript.NodeType.ClassDeclaration &&
                ((<TypeScript.FunctionDeclaration>this.asts[this.top - 2]).isConstructor) &&
                ((<TypeScript.FunctionDeclaration>this.asts[this.top - 2]).arguments === this.asts[this.top - 1]) &&
                ((<TypeScript.ClassDeclaration>this.asts[this.top - 4]).constructorDecl === this.asts[this.top - 2]);
        }

        public isChildOfInterface(): bool {
            var ast = lastOf(this.asts);
            return this.count() >= 3 &&
                this.asts[this.top] === ast &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.List &&
                this.asts[this.top - 2].nodeType === TypeScript.NodeType.InterfaceDeclaration;
        }

        public isTopLevelImplicitModule() {
            return this.count() >= 1 &&
                this.asts[this.top].nodeType === TypeScript.NodeType.ModuleDeclaration &&
                TypeScript.hasFlag((<TypeScript.ModuleDeclaration>this.asts[this.top]).getModuleFlags(), TypeScript.ModuleFlags.IsWholeFile);
        }

        public isBodyOfTopLevelImplicitModule() {
            return this.count() >= 2 &&
                this.asts[this.top - 0].nodeType === TypeScript.NodeType.List &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.ModuleDeclaration &&
                 (<TypeScript.ModuleDeclaration>this.asts[this.top - 1]).members === this.asts[this.top - 0] &&
                TypeScript.hasFlag((<TypeScript.ModuleDeclaration>this.asts[this.top - 1]).getModuleFlags(), TypeScript.ModuleFlags.IsWholeFile);
        }

        public isBodyOfScript(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.Script &&
                 (<TypeScript.Script>this.asts[this.top - 1]).moduleElements === this.asts[this.top - 0];
        }

        public isBodyOfSwitch(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.SwitchStatement &&
                 (<TypeScript.SwitchStatement>this.asts[this.top - 1]).caseList === this.asts[this.top - 0];
        }

        public isBodyOfModule(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.ModuleDeclaration &&
                 (<TypeScript.ModuleDeclaration>this.asts[this.top - 1]).members === this.asts[this.top - 0];
        }

        public isBodyOfClass(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.ClassDeclaration &&
                 (<TypeScript.ClassDeclaration>this.asts[this.top - 1]).members === this.asts[this.top - 0];
        }

        public isBodyOfFunction(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.FunctionDeclaration &&
                 (<TypeScript.FunctionDeclaration>this.asts[this.top - 1]).bod === this.asts[this.top - 0];
        }

        public isBodyOfInterface(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.InterfaceDeclaration &&
                 (<TypeScript.InterfaceDeclaration>this.asts[this.top - 1]).members === this.asts[this.top - 0];
        }

        public isBodyOfBlock(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.Block &&
                (<TypeScript.Block>this.asts[this.top - 1]).statements === this.asts[this.top - 0];
        }

        public isBodyOfFor(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.ForStatement &&
                (<TypeScript.ForStatement>this.asts[this.top - 1]).body === this.asts[this.top - 0];
        }

        public isBodyOfDoWhile(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.DoStatement &&
                (<TypeScript.DoWhileStatement>this.asts[this.top - 1]).body === this.asts[this.top - 0];
        }

        public isBodyOfWhile(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.WhileStatement &&
                (<TypeScript.WhileStatement>this.asts[this.top - 1]).body === this.asts[this.top - 0];
        }

        public isBodyOfForIn(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.ForInStatement &&
                (<TypeScript.ForInStatement>this.asts[this.top - 1]).body === this.asts[this.top - 0];
        }

        public isBodyOfWith(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.WithStatement &&
                (<TypeScript.WithStatement>this.asts[this.top - 1]).body === this.asts[this.top - 0];
        }

        public isCaseOfSwitch(): bool {
            return this.count() >= 3 &&
                this.asts[this.top - 2].nodeType === TypeScript.NodeType.SwitchStatement &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.List &&
                (<TypeScript.SwitchStatement>this.asts[this.top - 2]).caseList === this.asts[this.top - 1];
        }

        public isDefaultCaseOfSwitch(): bool {
            return this.count() >= 3 &&
                this.asts[this.top - 2].nodeType === TypeScript.NodeType.SwitchStatement &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.List &&
                (<TypeScript.SwitchStatement>this.asts[this.top - 2]).caseList === this.asts[this.top - 1] &&
                (<TypeScript.SwitchStatement>this.asts[this.top - 2]).defaultCase === this.asts[this.top - 0];
        }

        public isListOfObjectLit(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.ObjectLiteralExpression &&
                this.asts[this.top - 0].nodeType === TypeScript.NodeType.List &&
                (<TypeScript.UnaryExpression>this.asts[this.top - 1]).operand === this.asts[this.top - 0];
        }

        public isBodyOfObjectLit(): bool {
            return this.isListOfObjectLit();
        }

        public isEmptyListOfObjectLit(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.ObjectLiteralExpression &&
                this.asts[this.top - 0].nodeType === TypeScript.NodeType.List &&
                (<TypeScript.UnaryExpression>this.asts[this.top - 1]).operand === this.asts[this.top - 0] &&
                (<TypeScript.ASTList>this.asts[this.top - 0]).members.length === 0;
        }

        public isMemberOfObjectLit(): bool {
            return this.count() >= 3 &&
                this.asts[this.top - 2].nodeType === TypeScript.NodeType.ObjectLiteralExpression &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.List &&
                this.asts[this.top - 0].nodeType === TypeScript.NodeType.Member &&
                (<TypeScript.UnaryExpression>this.asts[this.top - 2]).operand === this.asts[this.top - 1];
        }

        public isNameOfMemberOfObjectLit(): bool {
            return this.count() >= 4 &&
                this.asts[this.top - 3].nodeType === TypeScript.NodeType.ObjectLiteralExpression &&
                this.asts[this.top - 2].nodeType === TypeScript.NodeType.List &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.Member &&
                this.asts[this.top - 0].nodeType === TypeScript.NodeType.Name &&
                (<TypeScript.UnaryExpression>this.asts[this.top - 3]).operand === this.asts[this.top - 2];
        }

        public isListOfArrayLit(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.ArrayLiteralExpression &&
                this.asts[this.top - 0].nodeType === TypeScript.NodeType.List &&
                (<TypeScript.UnaryExpression>this.asts[this.top - 1]).operand === this.asts[this.top - 0];
        }

        public isTargetOfMember(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.Member &&
                (<TypeScript.BinaryExpression>this.asts[this.top - 1]).operand1 === this.asts[this.top - 0];
        }

        public isMemberOfMember(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.Member &&
                (<TypeScript.BinaryExpression>this.asts[this.top - 1]).operand2 === this.asts[this.top - 0];
        }

        public isItemOfList(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.List;
            //(<Tools.ASTList>this.asts[this.top - 1]).operand2 === this.asts[this.top - 0];
        }

        public isThenOfIf(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.IfStatement &&
                (<TypeScript.IfStatement>this.asts[this.top - 1]).thenBod === this.asts[this.top - 0];
        }

        public isElseOfIf(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.IfStatement &&
                (<TypeScript.IfStatement>this.asts[this.top - 1]).elseBod === this.asts[this.top - 0];
        }

        public isSingleStatementList(): bool {
            return this.count() >= 1 &&
                this.asts[this.top].nodeType === TypeScript.NodeType.List &&
                (<TypeScript.ASTList>this.asts[this.top]).members.length === 1;
        }

        public isArgumentListOfFunction(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 0].nodeType === TypeScript.NodeType.List &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.FunctionDeclaration &&
                (<TypeScript.FunctionDeclaration>this.asts[this.top - 1]).arguments === this.asts[this.top - 0];
        }

        public isArgumentOfFunction(): bool {
            return this.count() >= 3 &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.List &&
                this.asts[this.top - 2].nodeType === TypeScript.NodeType.FunctionDeclaration &&
                (<TypeScript.FunctionDeclaration>this.asts[this.top - 2]).arguments === this.asts[this.top - 1];
        }

        public isArgumentListOfCall(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 0].nodeType === TypeScript.NodeType.List &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.Call &&
                (<TypeScript.CallExpression>this.asts[this.top - 1]).arguments === this.asts[this.top - 0];
        }

        public isArgumentListOfNew(): bool {
            return this.count() >= 2 &&
                this.asts[this.top - 0].nodeType === TypeScript.NodeType.List &&
                this.asts[this.top - 1].nodeType === TypeScript.NodeType.New &&
                (<TypeScript.CallExpression>this.asts[this.top - 1]).arguments === this.asts[this.top - 0];
        }

        public isSynthesizedBlock(): bool {
            return this.count() >= 1 &&
                this.asts[this.top - 0].nodeType === TypeScript.NodeType.Block &&
                (<TypeScript.Block>this.asts[this.top - 0]).isStatementBlock === false;
        }

        public isInClassImplementsList(): bool {
            if (this.ast() === null || this.parent() === null)
                return false;

            return (this.parent().nodeType === TypeScript.NodeType.ClassDeclaration) &&
                (this.isMemberOfList((<TypeScript.ClassDeclaration>this.parent()).implementsList, this.ast()));
        }

        public isInInterfaceExtendsList(): bool {
            if (this.ast() === null || this.parent() === null)
                return false;

            return (this.parent().nodeType === TypeScript.NodeType.InterfaceDeclaration) &&
                (this.isMemberOfList((<TypeScript.InterfaceDeclaration>this.parent()).extendsList, this.ast()));
        }

        private isMemberOfList(list: ASTList, item: AST): bool {
            if (list && list.members) {
                for (var i = 0, n = list.members.length; i < n; i++) {
                    if (list.members[i] === item) {
                        return true;
                    }
                }
            }

            return false;
        }
    }

    export function isValidAstNode(ast: TypeScript.IASTSpan): bool {
        if (ast === null)
            return false;

        if (ast.minChar === -1 || ast.limChar === -1)
            return false;

        return true;
    }

    export class AstPathContext {
        public path = new TypeScript.AstPath();
    }

    export enum GetAstPathOptions {
        Default = 0,
        EdgeInclusive = 1,
        //We need this options dealing with an AST coming from an incomplete AST. For example:
        //     class foo { // r
        // If we ask for the AST at the position after the "r" character, we won't see we are 
        // inside a comment, because the "class" AST node has a limChar corresponding to the position of 
        // the "{" character, meaning we don't traverse the tree down to the stmt list of the class, meaning
        // we don't find the "precomment" attached to the errorneous empty stmt.
        //TODO: It would be nice to be able to get rid of this.
        DontPruneSearchBasedOnPosition = 1 << 1,
    }

    ///
    /// Return the stack of AST nodes containing "position"
    ///
    export function getAstPathToPosition(script: TypeScript.AST, pos: number, options = GetAstPathOptions.Default): TypeScript.AstPath {
        var lookInComments = (comments: TypeScript.Comment[]) => {
            if (comments && comments.length > 0) {
                for (var i = 0; i < comments.length; i++) {
                    var minChar = comments[i].minChar;
                    var limChar = comments[i].limChar;
                    if (!comments[i].isBlockComment) {
                        limChar++; // For single line comments, include 1 more character (for the newline)
                    }
                    if (pos >= minChar && pos < limChar) {
                        ctx.path.push(comments[i]);
                    }
                }
            }
        }

        var pre = function (cur: TypeScript.AST, parent: TypeScript.AST, walker: IAstWalker) {
            if (isValidAstNode(cur)) {

                // Add "cur" to the stack if it contains our position
                // For "identifier" nodes, we need a special case: A position equal to "limChar" is
                // valid, since the position corresponds to a caret position (in between characters)
                // For example:
                //  bar
                //  0123
                // If "position === 3", the caret is at the "right" of the "r" character, which should be considered valid
                var inclusive =
                    hasFlag(options, GetAstPathOptions.EdgeInclusive) ||
                    cur.nodeType === TypeScript.NodeType.Name ||
                    cur.nodeType === TypeScript.NodeType.Dot ||
                    cur.nodeType === TypeScript.NodeType.TypeRef ||
                    pos === script.limChar; // Special "EOF" case

                var minChar = cur.minChar;
                var limChar = cur.limChar + (inclusive ? 1 : 0)
                if (pos >= minChar && pos < limChar) {

                    // TODO: Since AST is sometimes not correct wrt to position, only add "cur" if it's better
                    //       than top of the stack.
                    var previous = ctx.path.ast();
                    if (previous === null || (cur.minChar >= previous.minChar && cur.limChar <= previous.limChar)) {
                        ctx.path.push(cur);
                    }
                    else {
                        //logger.log("TODO: Ignoring node because minChar, limChar not better than previous node in stack");
                    }
                }

                // The AST walker skips comments, but we might be in one, so check the pre/post comments for this node manually
                if (pos < limChar) {
                    lookInComments(cur.preComments);
                }
                if (pos >= minChar) {
                    lookInComments(cur.postComments);
                }

                if (!hasFlag(options, GetAstPathOptions.DontPruneSearchBasedOnPosition)) {
                    // Don't go further down the tree if pos is outside of [minChar, limChar]
                    walker.options.goChildren = (minChar <= pos && pos <= limChar);
                }
            }
            return cur;
        }

        var ctx = new AstPathContext();
        TypeScript.getAstWalkerFactory().walk(script, pre, null, null, ctx);
        return ctx.path;
    }

    ///
    /// Simple function to Walk an AST using a simple callback function.
    ///
    export function walkAST(ast: TypeScript.AST, callback: (path: AstPath, walker: TypeScript.IAstWalker) => void ): void {
        var pre = function (cur: TypeScript.AST, parent: TypeScript.AST, walker: TypeScript.IAstWalker) {
            var path: TypeScript.AstPath = walker.state;
            path.push(cur);
            callback(path, walker);
            return cur;
        }
        var post = function (cur: TypeScript.AST, parent: TypeScript.AST, walker: TypeScript.IAstWalker) {
            var path: TypeScript.AstPath = walker.state;
            path.pop();
            return cur;
        }

        var path = new AstPath();
        TypeScript.getAstWalkerFactory().walk(ast, pre, post, null, path);
    }
}
