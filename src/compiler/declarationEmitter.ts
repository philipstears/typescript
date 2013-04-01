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
    export class DeclFileWriter {
        public onNewLine = true;
        constructor(private declFile: ITextWriter) {
        }

        public Write(s: string) {
            this.declFile.Write(s);
            this.onNewLine = false;
        }

        public WriteLine(s: string) {
            this.declFile.WriteLine(s);
            this.onNewLine = true;
        }

        public Close() {
            try {
                this.declFile.Close();
            }
            catch (e) {
                Emitter.throwEmitterError(e);
            }
        }
    }
    
    export class DeclarationEmitter implements AstWalkerWithDetailCallback.AstWalkerDetailCallback {
        public locationInfo: LocationInfo = null;
        private declFile: DeclFileWriter = null;
        private indenter = new Indenter();
        private declarationContainerStack: AST[] = [];
        private isDottedModuleName: bool[] = [];
        private dottedModuleEmit: string;
        private ignoreCallbackAst: AST = null;
        private singleDeclFile: DeclFileWriter = null;
        private varListCount: number = 0;

        constructor(private emittingFileName: string,
            isUTF8: bool,
            private semanticInfoChain: SemanticInfoChain,
            public emitOptions: EmitOptions) {
            // Creating files can cause exceptions, report them.   
            var file = this.createFile(emittingFileName, isUTF8);
            this.declFile = new DeclFileWriter(file);
        }

        public close() {
            try {
                this.declFile.Close();
            }
            catch (e) {
                Emitter.throwEmitterError(e);
            }
        }

        private createFile(fileName: string, useUTF8: bool): ITextWriter {
            try {
                return this.emitOptions.ioHost.createFile(fileName, useUTF8);
            }
            catch (e) {
                Emitter.throwEmitterError(e);
            }
        }

        public emitDeclarations(script: TypeScript.Script): void {
            AstWalkerWithDetailCallback.walk(script, this);
        }

        public getAstDeclarationContainer() {
            return this.declarationContainerStack[this.declarationContainerStack.length - 1];
        }

        private emitDottedModuleName() {
            return (this.isDottedModuleName.length === 0) ? false : this.isDottedModuleName[this.isDottedModuleName.length - 1];
        }

        private getIndentString(declIndent = false) {
            if (this.emitOptions.compilationSettings.minWhitespace) {
                return "";
            }
            else {
                return this.indenter.getIndent();
            }
        }

        private emitIndent() {
            this.declFile.Write(this.getIndentString());
        }

        private canEmitSignature(declFlags: DeclFlags, canEmitGlobalAmbientDecl: bool = true, useDeclarationContainerTop: bool = true) {
            var container: AST;
            if (useDeclarationContainerTop) {
                container = this.getAstDeclarationContainer();
            } else {
                container = this.declarationContainerStack[this.declarationContainerStack.length - 2];
            }

            if (container.nodeType === NodeType.ModuleDeclaration && !hasFlag(declFlags, DeclFlags.Exported)) {
                return false;
            }

            if (!canEmitGlobalAmbientDecl && container.nodeType === NodeType.Script && hasFlag(declFlags, DeclFlags.Ambient)) {
                return false;
            }

            return true;
        }

        private canEmitPrePostAstSignature(declFlags: DeclFlags, astWithPrePostCallback: AST, preCallback: bool) {
            if (this.ignoreCallbackAst) {
                CompilerDiagnostics.assert(this.ignoreCallbackAst != astWithPrePostCallback, "Ignore Callback AST mismatch");
                this.ignoreCallbackAst = null;
                return false;
            } else if (preCallback &&
                !this.canEmitSignature(declFlags, true, preCallback)) {
                this.ignoreCallbackAst = astWithPrePostCallback;
                return false;
            }

            return true;
        }

        private getDeclFlagsString(declFlags: DeclFlags, typeString: string) {
            var result = this.getIndentString();

            // Emit export only for global export statements. The container for this would be dynamic module which is whole file
            var container = this.getAstDeclarationContainer();
            if (container.nodeType === NodeType.ModuleDeclaration &&
                hasFlag((<ModuleDeclaration>container).getModuleFlags(), ModuleFlags.IsWholeFile) &&
                hasFlag(declFlags, DeclFlags.Exported)) {
                result += "export ";
            }

            // Static/public/private/global declare
            if (hasFlag(declFlags, DeclFlags.Static)) {
                if (hasFlag(declFlags, DeclFlags.Private)) {
                    result += "private ";
                }
                result += "static ";
            }
            else {
                if (hasFlag(declFlags, DeclFlags.Private)) {
                    result += "private ";
                }
                else if (hasFlag(declFlags, DeclFlags.Public)) {
                    result += "public ";
                }
                else {
                    result += typeString + " ";
                }
            }

            return result;
        }

        private emitDeclFlags(declFlags: DeclFlags, typeString: string) {
            this.declFile.Write(this.getDeclFlagsString(declFlags, typeString));
        }

        private canEmitTypeAnnotationSignature(declFlag: DeclFlags = DeclFlags.None) {
            // Private declaration, shouldnt emit type any time.
            return !hasFlag(declFlag, DeclFlags.Private);
        }

        private pushDeclarationContainer(ast: AST) {
            this.declarationContainerStack.push(ast);
        }

        private popDeclarationContainer(ast: AST) {
            CompilerDiagnostics.assert(ast != this.getAstDeclarationContainer(), 'Declaration container mismatch');
            this.declarationContainerStack.pop();
        }

        public emitTypeNamesMember(memberName: MemberName, emitIndent: bool = false) {
            if (memberName.prefix === "{ ") {
                if (emitIndent) {
                    this.emitIndent();
                }
                this.declFile.WriteLine("{");
                this.indenter.increaseIndent();
                emitIndent = true;
            } else if (memberName.prefix != "") {
                if (emitIndent) {
                    this.emitIndent();
                }
                this.declFile.Write(memberName.prefix);
                emitIndent = false;
            }

            if (memberName.isString()) {
                if (emitIndent) {
                    this.emitIndent();
                }
                this.declFile.Write((<MemberNameString>memberName).text);
            } else {
                var ar = <MemberNameArray>memberName;
                for (var index = 0; index < ar.entries.length; index++) {
                    this.emitTypeNamesMember(ar.entries[index], emitIndent);
                    if (ar.delim === "; ") {
                        this.declFile.WriteLine(";");
                    }
                }
            }

            if (memberName.suffix === "}") {
                this.indenter.decreaseIndent();
                this.emitIndent();
                this.declFile.Write(memberName.suffix);
            } else {
                this.declFile.Write(memberName.suffix);
            }
        }

        private emitTypeSignature(type: PullTypeSymbol) {
            var declarationContainerAst = this.getAstDeclarationContainer();
            var declarationPullSymbol = this.semanticInfoChain.getSymbolForAST(declarationContainerAst, this.locationInfo.fileName);
            var typeNameMembers = type.getScopedNameEx(declarationPullSymbol);
            this.emitTypeNamesMember(typeNameMembers);
        }

        private emitComment(comment: Comment) {
            var text = comment.getText();
            if (this.declFile.onNewLine) {
                this.emitIndent();
            } else if (!comment.isBlockComment) {
                this.declFile.WriteLine("");
                this.emitIndent();
            }
            
            this.declFile.Write(text[0]);

            for (var i = 1; i < text.length; i++) {
                this.declFile.WriteLine("");
                this.emitIndent();
                this.declFile.Write(text[i]);
            }

            if (comment.endsLine || !comment.isBlockComment) {
                this.declFile.WriteLine("");
            } else {
                this.declFile.Write(" ");
            }
        }

        private emitDeclarationComments(ast: AST, endLine?: bool);
        private emitDeclarationComments(symbol: Symbol, endLine?: bool);
        private emitDeclarationComments(astOrSymbol, endLine = true) {
            if (!this.emitOptions.compilationSettings.emitComments) {
                return;
            }

            var declComments = <Comment[]>astOrSymbol.getDocComments();
            this.writeDeclarationComments(declComments, endLine);
        }

        public writeDeclarationComments(declComments: Comment[], endLine = true) {
            if (declComments.length > 0) {
                for (var i = 0; i < declComments.length; i++) {
                    this.emitComment(declComments[i]);
                }

                if (endLine) {
                    if (!this.declFile.onNewLine) {
                        this.declFile.WriteLine("");
                    }
                } else {
                    if (this.declFile.onNewLine) {
                        this.emitIndent();
                    }
                }
            }
        }

        public emitTypeOfBoundDecl(boundDecl: BoundDecl) {
            var pullSymbol = this.semanticInfoChain.getSymbolForAST(boundDecl, this.locationInfo.fileName);
            var type = pullSymbol.getType();
            if (!type) {
                // PULLTODO
                return;
            }
            if (boundDecl.typeExpr || // Specified type expression
                (boundDecl.init && type != this.semanticInfoChain.anyTypeSymbol)) { // Not infered any
                this.declFile.Write(": ");
                this.emitTypeSignature(type);
            }
        }

        public VarDeclCallback(pre: bool, varDecl: VarDecl): bool {
            if (pre && this.canEmitSignature(ToDeclFlags(varDecl.getVarFlags()), false)) {
                var interfaceMember = (this.getAstDeclarationContainer().nodeType === NodeType.InterfaceDeclaration);
                this.emitDeclarationComments(varDecl);
                if (!interfaceMember) {
                    // If it is var list of form var a, b, c = emit it only if count > 0 - which will be when emitting first var
                    // If it is var list of form  var a = varList count will be 0
                    if (this.varListCount >= 0) {
                        this.emitDeclFlags(ToDeclFlags(varDecl.getVarFlags()), "var");
                        this.varListCount = -this.varListCount;
                    }
                    this.declFile.Write(varDecl.id.text);
                } else {
                    this.emitIndent();
                    this.declFile.Write(varDecl.id.text);
                    if (hasFlag(varDecl.id.getFlags(), ASTFlags.OptionalName)) {
                        this.declFile.Write("?");
                    }
                }

                if (this.canEmitTypeAnnotationSignature(ToDeclFlags(varDecl.getVarFlags()))) {
                    this.emitTypeOfBoundDecl(varDecl);
                }
               
                // emitted one var decl
                if (this.varListCount > 0) { this.varListCount--; } else if (this.varListCount < 0) { this.varListCount++; }

                // Write ; or ,
                if (this.varListCount < 0) {
                    this.declFile.Write(", ");
                } else {
                    this.declFile.WriteLine(";");
                }
            }
            return false;
        }

        public BlockCallback(pre: bool, block: Block): bool {
            if (!block.isStatementBlock) {
                if (pre) {
                    this.varListCount = block.statements.members.length;
                } else {
                    this.varListCount = 0;
                }
                return true;
            }
            return false;
        }

        private emitArgDecl(argDecl: ArgDecl, funcDecl: FuncDecl) {
            this.emitDeclarationComments(argDecl, false);
            this.declFile.Write(argDecl.id.text);
            if (argDecl.isOptionalArg()) {
                this.declFile.Write("?");
            }
            if (this.canEmitTypeAnnotationSignature(ToDeclFlags(funcDecl.getFunctionFlags()))) {
                this.emitTypeOfBoundDecl(argDecl);
            }
        }

        public isOverloadedCallSignature(funcDecl: FuncDecl) {
            var funcSymbol = this.semanticInfoChain.getSymbolForAST(funcDecl, this.locationInfo.fileName);
            var funcTypeSymbol = funcSymbol.getType();
            var signatures = funcTypeSymbol.getCallSignatures();
            return signatures && signatures.length > 1;
        }

        public FuncDeclCallback(pre: bool, funcDecl: FuncDecl): bool {
            if (!pre) {
                return false;
            }

            if (funcDecl.isAccessor()) {
                return this.emitPropertyAccessorSignature(funcDecl);
            }

            var isInterfaceMember = (this.getAstDeclarationContainer().nodeType === NodeType.InterfaceDeclaration);
            var funcSymbol = this.semanticInfoChain.getSymbolForAST(funcDecl, this.locationInfo.fileName);
            var funcTypeSymbol = funcSymbol.getType();
            if (funcDecl.bod) {
                var constructSignatures = funcTypeSymbol.getConstructSignatures();
                if (constructSignatures && constructSignatures.length > 1) {
                    return false;
                }
                else if (this.isOverloadedCallSignature(funcDecl)) {
                    // This means its implementation of overload signature. do not emit
                    return false;
                }
            } else if (!isInterfaceMember && hasFlag(funcDecl.getFunctionFlags(), FunctionFlags.Private) && this.isOverloadedCallSignature(funcDecl)) {
                // Print only first overload of private function
                var callSignatures = funcTypeSymbol.getCallSignatures();
                Debug.assert(callSignatures && callSignatures.length > 1);
                var firstSignature = callSignatures[0].isDefinition() ? callSignatures[1] : callSignatures[0];
                var firstSignatureDecl = firstSignature.getDeclarations()[0];
                var firstFuncDecl = <FuncDecl>PullHelpers.getASTForDecl(firstSignatureDecl, this.semanticInfoChain);
                if (firstFuncDecl != funcDecl) {
                    return false;
                }
            }

            if (!this.canEmitSignature(ToDeclFlags(funcDecl.getFunctionFlags()), false)) {
                return false;
            }

            var funcSignatureInfo = PullHelpers.getSignatureForFuncDecl(funcDecl, this.semanticInfoChain, this.locationInfo.fileName);
            var funcSignature = funcSignatureInfo ? funcSignatureInfo.signature : null;
            this.emitDeclarationComments(funcDecl);
            if (funcDecl.isConstructor) {
                this.emitIndent();
                this.declFile.Write("constructor");
                this.emitTypeParameters(funcDecl.typeArguments, funcSignature);
            }
            else {
                var id = funcDecl.getNameText();
                if (!isInterfaceMember) {
                    this.emitDeclFlags(ToDeclFlags(funcDecl.getFunctionFlags()), "function");
                    if (id != "__missing" || !funcDecl.name || !funcDecl.name.isMissing()) {
                        this.declFile.Write(id);
                    } else if (funcDecl.isConstructMember()) {
                        this.declFile.Write("new");
                    }
                    this.emitTypeParameters(funcDecl.typeArguments, funcSignature);
                } else {
                    this.emitIndent();
                    if (funcDecl.isConstructMember()) {
                        this.declFile.Write("new");
                        this.emitTypeParameters(funcDecl.typeArguments, funcSignature);
                    } else if (!funcDecl.isCallMember() && !funcDecl.isIndexerMember()) {
                        this.declFile.Write(id);
                        this.emitTypeParameters(funcDecl.typeArguments, funcSignature);
                        if (hasFlag(funcDecl.name.getFlags(), ASTFlags.OptionalName)) {
                            this.declFile.Write("? ");
                        }
                    } else {
                        this.emitTypeParameters(funcDecl.typeArguments, funcSignature);
                    }
                }
            }

            if (!funcDecl.isIndexerMember()) {
                this.declFile.Write("(");
            } else {
                this.declFile.Write("[");
            }

            this.indenter.increaseIndent();

            if (funcDecl.arguments) {
                var argsLen = funcDecl.arguments.members.length;
                if (funcDecl.variableArgList) {
                    argsLen--;
                }
                for (var i = 0; i < argsLen; i++) {
                    var argDecl = <ArgDecl>funcDecl.arguments.members[i];
                    this.emitArgDecl(argDecl, funcDecl);
                    if (i < (argsLen - 1)) {
                        this.declFile.Write(", ");
                    }
                }
            }

            if (funcDecl.variableArgList) {
                var lastArg = <ArgDecl>funcDecl.arguments.members[funcDecl.arguments.members.length - 1];
                if (funcDecl.arguments.members.length > 1) {
                    this.declFile.Write(", ...");
                }
                else {
                    this.declFile.Write("...");
                }
                this.emitArgDecl(lastArg, funcDecl);
            }

            this.indenter.decreaseIndent();

            if (!funcDecl.isIndexerMember()) {
                this.declFile.Write(")");
            } else {
                this.declFile.Write("]");
            }

            if (!funcDecl.isConstructor &&
                this.canEmitTypeAnnotationSignature(ToDeclFlags(funcDecl.getFunctionFlags()))) {
                var returnType = funcSignature.getReturnType();
                if (funcDecl.returnTypeAnnotation ||
                    (returnType && returnType != this.semanticInfoChain.anyTypeSymbol)) {
                    this.declFile.Write(": ");
                    this.emitTypeSignature(returnType);
                }
            }

            this.declFile.WriteLine(";");

            return false;
        }

        public emitBaseExpression(bases: ASTList, index: number, useExtendsList: bool) {
            var containerAst = this.getAstDeclarationContainer();
            var containerSymbol = <PullTypeSymbol>this.semanticInfoChain.getSymbolForAST(containerAst, this.locationInfo.fileName);
            var baseType: PullTypeSymbol
            if (useExtendsList) {
                baseType = containerSymbol.getExtendedTypes()[index];
            } else {
                baseType = containerSymbol.getImplementedTypes()[index];
            }

            if (baseType) {
                this.emitTypeSignature(baseType);
            }
        }

        private emitBaseList(typeDecl: TypeDeclaration, useExtendsList: bool) {
            var bases = useExtendsList ? typeDecl.extendsList : typeDecl.implementsList;
            if (bases && (bases.members.length > 0)) {
                var qual = useExtendsList ? "extends" : "implements";
                this.declFile.Write(" " + qual + " ");
                var basesLen = bases.members.length;
                for (var i = 0; i < basesLen; i++) {
                    if (i > 0) {
                        this.declFile.Write(", ");
                    }
                    this.emitBaseExpression(bases, i, useExtendsList);
                }
            }
        }

        private emitAccessorDeclarationComments(funcDecl: FuncDecl) {
            if (!this.emitOptions.compilationSettings.emitComments) {
                return;
            }

            var accessors = PullHelpers.getGetterAndSetterFunction(funcDecl, this.semanticInfoChain, this.locationInfo.fileName);
            var comments: Comment[] = [];
            if (accessors.getter) {
                comments = comments.concat(accessors.getter.getDocComments());
            }
            if (accessors.setter) {
                comments = comments.concat(accessors.setter.getDocComments());
            }
            this.writeDeclarationComments(comments);
        }

        public emitPropertyAccessorSignature(funcDecl: FuncDecl) {
            var accessorSymbol = PullHelpers.getAccessorSymbol(funcDecl, this.semanticInfoChain, this.locationInfo.fileName);
            if (!hasFlag(funcDecl.getFunctionFlags(), FunctionFlags.GetAccessor) && accessorSymbol.getGetter()) {
                // Setter is being used to emit the type info. 
                return false;
            }

            this.emitAccessorDeclarationComments(funcDecl);
            this.emitDeclFlags(ToDeclFlags(funcDecl.getFunctionFlags()), "var");
            this.declFile.Write(funcDecl.name.text);
            if (this.canEmitTypeAnnotationSignature(ToDeclFlags(funcDecl.getFunctionFlags()))) {
                this.declFile.Write(" : ");
                var type = accessorSymbol.getType();
                this.emitTypeSignature(type);
            }
            this.declFile.WriteLine(";");

            return false;
        }

        private emitClassMembersFromConstructorDefinition(funcDecl: FuncDecl) {
            if (funcDecl.arguments) {
                var argsLen = funcDecl.arguments.members.length; if (funcDecl.variableArgList) { argsLen--; }

                for (var i = 0; i < argsLen; i++) {
                    var argDecl = <ArgDecl>funcDecl.arguments.members[i];
                    if (hasFlag(argDecl.getVarFlags(), VariableFlags.Property)) {
                        this.emitDeclarationComments(argDecl);
                        this.emitDeclFlags(ToDeclFlags(argDecl.getVarFlags()), "var");
                        this.declFile.Write(argDecl.id.text);

                        if (this.canEmitTypeAnnotationSignature(ToDeclFlags(argDecl.getVarFlags()))) {
                            this.emitTypeOfBoundDecl(argDecl);
                        }
                        this.declFile.WriteLine(";");
                    }
                }
            }
        }

        public ClassDeclarationCallback(pre: bool, classDecl: ClassDeclaration): bool {
            if (!this.canEmitPrePostAstSignature(ToDeclFlags(classDecl.getVarFlags()), classDecl, pre)) {
                return false;
            }

            if (pre) {
                var className = classDecl.name.text;
                this.emitDeclarationComments(classDecl);
                this.emitDeclFlags(ToDeclFlags(classDecl.getVarFlags()), "class");
                this.declFile.Write(className);
                this.pushDeclarationContainer(classDecl);
                this.emitTypeParameters(classDecl.typeParameters);
                this.emitBaseList(classDecl, true);
                this.emitBaseList(classDecl, false);
                this.declFile.WriteLine(" {");

                this.indenter.increaseIndent();
                if (classDecl.constructorDecl) {
                    this.emitClassMembersFromConstructorDefinition(classDecl.constructorDecl);
                }
            } else {
                this.indenter.decreaseIndent();
                this.popDeclarationContainer(classDecl);

                this.emitIndent();
                this.declFile.WriteLine("}");
            }

            return true;
        }

        private emitTypeParameters(typeParams: ASTList, funcSignature?: PullSignatureSymbol) {
            if (!typeParams || !typeParams.members.length) {
                return;
            }

            this.declFile.Write("<");
            var containerAst = this.getAstDeclarationContainer();
            var containerSymbol = <PullTypeSymbol>this.semanticInfoChain.getSymbolForAST(containerAst, this.locationInfo.fileName);
            var typars: PullTypeSymbol[];
            if (funcSignature) {
                typars = funcSignature.getTypeParameters();
            } else {
                typars = containerSymbol.getTypeArguments();
                if (!typars || !typars.length) {
                    typars = containerSymbol.getTypeParameters();
                }
            }

            for (var i = 0; i < typars.length; i++) {
                if (i) {
                    this.declFile.Write(", ");
                }
                var memberName = typars[i].getScopedNameEx(containerSymbol, true);
                this.emitTypeNamesMember(memberName);
            }
            this.declFile.Write(">");
        }

        public InterfaceDeclarationCallback(pre: bool, interfaceDecl: InterfaceDeclaration): bool {
            if (!this.canEmitPrePostAstSignature(ToDeclFlags(interfaceDecl.getVarFlags()), interfaceDecl, pre)) {
                return false;
            }

            if (pre) {
                var interfaceName = interfaceDecl.name.text;
                this.emitDeclarationComments(interfaceDecl);
                this.emitDeclFlags(ToDeclFlags(interfaceDecl.getVarFlags()), "interface");
                this.declFile.Write(interfaceName);
                this.pushDeclarationContainer(interfaceDecl);
                this.emitTypeParameters(interfaceDecl.typeParameters);
                this.emitBaseList(interfaceDecl, true);
                this.declFile.WriteLine(" {");

                this.indenter.increaseIndent();
            } else {
                this.indenter.decreaseIndent();
                this.popDeclarationContainer(interfaceDecl);

                this.emitIndent();
                this.declFile.WriteLine("}");
            }

            return true;
        }

        public ImportDeclarationCallback(pre: bool, importDecl: ImportDeclaration): bool {
            if (pre) {
                if ((<Script>this.declarationContainerStack[0]).isExternallyVisibleSymbol(importDecl.id.sym)) {
                    this.emitDeclarationComments(importDecl);
                    this.emitIndent();
                    this.declFile.Write("import ");

                    this.declFile.Write(importDecl.id.text + " = ");
                    if (importDecl.isDynamicImport) {
                        this.declFile.WriteLine("module (" + importDecl.getAliasName() + ");");
                    } else {
                        this.declFile.WriteLine(importDecl.getAliasName() + ";");
                    }
                }
            }

            return false;
        }

        private emitEnumSignature(moduleDecl: ModuleDeclaration) {
            if (!this.canEmitSignature(ToDeclFlags(moduleDecl.getModuleFlags()))) {
                return false;
            }

            this.emitDeclarationComments(moduleDecl);
            this.emitDeclFlags(ToDeclFlags(moduleDecl.getModuleFlags()), "enum");
            this.declFile.WriteLine(moduleDecl.name.text + " {");

            this.indenter.increaseIndent();
            var membersLen = moduleDecl.members.members.length;
            for (var j = 1; j < membersLen; j++) {
                var memberDecl: AST = moduleDecl.members.members[j];
                if (memberDecl.nodeType === NodeType.VarDecl) {
                    this.emitDeclarationComments(memberDecl);
                    this.emitIndent();
                    this.declFile.WriteLine((<VarDecl>memberDecl).id.text + ",");
                } else {
                    CompilerDiagnostics.assert(memberDecl.nodeType != NodeType.Asg, "We want to catch this");
                }
            }
            this.indenter.decreaseIndent();

            this.emitIndent();
            this.declFile.WriteLine("}");

            return false;
        }

        public ModuleDeclarationCallback(pre: bool, moduleDecl: ModuleDeclaration): bool {
            if (hasFlag(moduleDecl.getModuleFlags(), ModuleFlags.IsWholeFile)) {
                // This is dynamic modules and we are going to outputing single file, 
                // we need to change the declFile because dynamic modules are always emitted to their corresponding .d.ts
                if (hasFlag(moduleDecl.getModuleFlags(), ModuleFlags.IsDynamic)) {
                    if (pre) {
                        if (!this.emitOptions.outputMany) {
                            this.singleDeclFile = this.declFile;
                            CompilerDiagnostics.assert(this.indenter.indentAmt === 0, "Indent has to be 0 when outputing new file");
                            // Create new file
                            var tsFileName = (<Script>this.getAstDeclarationContainer()).locationInfo.fileName;
                            var declareFileName = this.emitOptions.mapOutputFileName(tsFileName, TypeScriptCompiler.mapToDTSFileName);
                            var useUTF8InOutputfile = moduleDecl.containsUnicodeChar || (this.emitOptions.compilationSettings.emitComments && moduleDecl.containsUnicodeCharInComment);

                            // Creating files can cause exceptions, they will be caught higher up in TypeScriptCompiler.emit
                            this.declFile = new DeclFileWriter(this.createFile(declareFileName, useUTF8InOutputfile));
                        }
                        this.pushDeclarationContainer(moduleDecl);
                    } else {
                        if (!this.emitOptions.outputMany) {
                            CompilerDiagnostics.assert(this.singleDeclFile != this.declFile, "singleDeclFile cannot be null as we are going to revert back to it");
                            CompilerDiagnostics.assert(this.indenter.indentAmt === 0, "Indent has to be 0 when outputing new file");

                            // Creating files can cause exceptions, they will be caught higher up in TypeScriptCompiler.emit
                            try {
                                this.declFile.Close();
                            }
                            catch (e) {
                                Emitter.throwEmitterError(e);
                            }

                            this.declFile = this.singleDeclFile;
                        }

                        this.popDeclarationContainer(moduleDecl);
                    }
                }

                return true;
            }

            if (moduleDecl.isEnum()) {
                if (pre) {
                    this.emitEnumSignature(moduleDecl);
                }
                return false;
            }

            if (!this.canEmitPrePostAstSignature(ToDeclFlags(moduleDecl.getModuleFlags()), moduleDecl, pre)) {
                return false;
            }

            if (pre) {
                if (this.emitDottedModuleName()) {
                    this.dottedModuleEmit += ".";
                } else {
                    this.dottedModuleEmit = this.getDeclFlagsString(ToDeclFlags(moduleDecl.getModuleFlags()), "module");
                }
                this.dottedModuleEmit += moduleDecl.name.text;

                var isCurrentModuleDotted = (moduleDecl.members.members.length === 1 &&
                    moduleDecl.members.members[0].nodeType === NodeType.ModuleDeclaration &&
                    !(<ModuleDeclaration>moduleDecl.members.members[0]).isEnum() &&
                    hasFlag((<ModuleDeclaration>moduleDecl.members.members[0]).getModuleFlags(), ModuleFlags.Exported));

                // Module is dotted only if it does not have doc comments for it
                var moduleDeclComments = moduleDecl.getDocComments();
                isCurrentModuleDotted = isCurrentModuleDotted && (moduleDeclComments === null || moduleDeclComments.length === 0);

                this.isDottedModuleName.push(isCurrentModuleDotted);
                this.pushDeclarationContainer(moduleDecl);

                if (!isCurrentModuleDotted) {
                    this.emitDeclarationComments(moduleDecl);
                    this.declFile.Write(this.dottedModuleEmit);
                    this.declFile.WriteLine(" {");
                    this.indenter.increaseIndent();
                }
            } else {
                if (!this.emitDottedModuleName()) {
                    this.indenter.decreaseIndent();
                    this.emitIndent();
                    this.declFile.WriteLine("}");
                }
                this.popDeclarationContainer(moduleDecl);
                this.isDottedModuleName.pop();
            }

            return true;
        }

        public ScriptCallback(pre: bool, script: Script): bool {
            if (pre) {
                this.locationInfo = script.locationInfo;
                if (this.emitOptions.outputMany) {
                    for (var i = 0; i < script.referencedFiles.length; i++) {
                        var referencePath = script.referencedFiles[i].path;
                        var declareFileName: string;
                        if (isRooted(referencePath)) {
                            declareFileName = this.emitOptions.mapOutputFileName(referencePath, TypeScriptCompiler.mapToDTSFileName)
                        } else {
                            declareFileName = getDeclareFilePath(script.referencedFiles[i].path);
                        }
                        this.declFile.WriteLine('/// <reference path="' + declareFileName + '" />');
                    }
                }
                this.pushDeclarationContainer(script);
            }
            else {
                this.popDeclarationContainer(script);
            }
            return true;
        }

        public DefaultCallback(pre: bool, ast: AST): bool {
            return !ast.isStatement();
        }
    }
}