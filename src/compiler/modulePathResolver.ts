/// <reference path="references.ts" />
/// <reference path="io.ts" />

module TypeScript {
    export class StandardResolverHost implements ITopLevelImportResolverHost {
        constructor(private ioHost: IIO) {
            this.ioHost = this.ioHost || IO;
        }

        resolveRelativePath(path: string, directory: string): string {
            var start = new Date().getTime();

            var unQuotedPath = stripStartAndEndQuotes(path);
            var normalizedPath: string;

            if (isRooted(unQuotedPath) || !directory) {
                normalizedPath = unQuotedPath;
            } else {
                normalizedPath = IOUtils.combine(directory, unQuotedPath);
            }

            // get the absolute path
            normalizedPath = this.resolvePath(normalizedPath);

            // Switch to forward slashes
            normalizedPath = switchToForwardSlashes(normalizedPath);

            return normalizedPath;
        }

        private fileExistsCache = createIntrinsicsObject<boolean>();

        fileExists(path: string): boolean {
            var exists = this.fileExistsCache[path];
            if (exists === undefined) {
                var start = new Date().getTime();
                exists = this.ioHost.fileExists(path);
                this.fileExistsCache[path] = exists;
                TypeScript.compilerFileExistsTime += new Date().getTime() - start;
            }

            return exists;
        }

        getParentDirectory(path: string): string {
            var start = new Date().getTime();
            var result = this.ioHost.dirName(path);
            TypeScript.compilerDirectoryNameTime += new Date().getTime() - start;

            return result;
        }

        // For performance reasons we cache the results of resolvePath.  This avoids costly lookup
        // on the disk once we've already resolved a path once.
        private resolvePathCache = createIntrinsicsObject<string>();

        resolvePath(path: string): string {
            var cachedValue = this.resolvePathCache[path];
            if (!cachedValue) {
                var start = new Date().getTime();
                cachedValue = this.ioHost.resolvePath(path);
                this.resolvePathCache[path] = cachedValue;
                TypeScript.compilerResolvePathTime += new Date().getTime() - start;
            }

            return cachedValue;
        }
    }

    export interface IResolvedImport {
        absoluteModuleIdentifier: string;
        absoluteModulePath: string;        
    }

    export interface ITopLevelImportResolverHost {
        resolveRelativePath(path: string, directory: string): string;
        fileExists(path: string): boolean;
        getParentDirectory(path: string): string;
    }

    export interface ITopLevelImportResolver {
        resolve(referencingModulePath: string, moduleIdentifier: string): IResolvedImport;
    }

    class TopLevelImportResolver implements ITopLevelImportResolver {
        constructor(private host: ITopLevelImportResolverHost) {
        }

        resolve(referencingModulePath: string, moduleIdentifier: string): IResolvedImport {
            TypeScript.Debug.assert(!isRelative(moduleIdentifier), "Relative paths should not get to the module path resolver");
            TypeScript.Debug.assert(!isRooted(moduleIdentifier), "Rooted paths should not get to the module path resolver");

            // Search for the file
            var parentDirectory = this.host.getParentDirectory(referencingModulePath);
            var dtsFileName = moduleIdentifier + ".d.ts";
            var tsFileName = moduleIdentifier + ".ts";

            var importDetails: IResolvedImport;

            var start = new Date().getTime();

            do {
                importDetails = this.resolvePackagedModuleInDirectory(parentDirectory, moduleIdentifier, tsFileName, dtsFileName);

                if (importDetails !== null) {
                    break;
                }

                importDetails = this.resolveModuleInDirectory(parentDirectory, moduleIdentifier, tsFileName, dtsFileName);

                if (importDetails !== null) {
                    break;
                }

                parentDirectory = this.host.getParentDirectory(parentDirectory);
            }
            while (parentDirectory);

            TypeScript.fileResolutionImportFileSearchTime += new Date().getTime() - start;

            return importDetails;
        }

        private resolveModuleInDirectory(directoryPath: string, moduleIdentifier: string, tsFileName: string, dtsFileName: string): IResolvedImport {

            // Search for ".d.ts" file first
            var currentFilePath = this.host.resolveRelativePath(dtsFileName, directoryPath);
            if (this.host.fileExists(currentFilePath)) {
                return {
                    absoluteModuleIdentifier: this.host.resolveRelativePath(moduleIdentifier, directoryPath),
                    absoluteModulePath: currentFilePath
                };
            }

            // Search for ".ts" file
            currentFilePath = this.host.resolveRelativePath(tsFileName, directoryPath);
            if (this.host.fileExists(currentFilePath)) {
                return {
                    absoluteModuleIdentifier: this.host.resolveRelativePath(moduleIdentifier, directoryPath),
                    absoluteModulePath: currentFilePath
                };
            }

            return null;
        }

        private resolvePackagedModuleInDirectory(directoryPath: string, moduleIdentifier: string, tsFileName: string, dtsFileName: string): IResolvedImport {
            var modulesDirectory = this.host.resolveRelativePath("ts_modules", directoryPath);
            var currentFilePath: string;
            var resolvedImport: IResolvedImport;

            // See if we've got a flat file in the modules directory
            resolvedImport = this.resolveModuleInDirectory(modulesDirectory, moduleIdentifier, tsFileName, dtsFileName);

            if (resolvedImport !== null) {
                return resolvedImport;
            }

            // How about a package JSON file in a module directory?
            var moduleDirectory = this.host.resolveRelativePath(moduleIdentifier, modulesDirectory);
            var packageJson = this.host.resolveRelativePath("tspackage.json", moduleDirectory);

            if (this.host.fileExists(packageJson)) {

                // TODO: Read the package
                return null;
            }

            // How about an index.ts in the module directory?
            var indexFile = this.host.resolveRelativePath("index.ts", moduleDirectory);

            if (this.host.fileExists(indexFile)) {
                return {
                    absoluteModuleIdentifier: this.host.resolveRelativePath("index", moduleDirectory),
                    absoluteModulePath: indexFile
                };
            }            
        }
    }

    class DirectoryResolverWithCache implements ITopLevelImportResolver {
        private modules = new StringHashTable<IResolvedImport>();

        constructor(private resolver: ITopLevelImportResolver) {
        }

        resolve(referencingModulePath: string, moduleIdentifier: string): IResolvedImport {
            var modulePath = this.modules.lookup(moduleIdentifier);

            if (!modulePath) {
                modulePath = this.resolver.resolve(referencingModulePath, moduleIdentifier);
                this.modules.add(moduleIdentifier, modulePath);
            }

            return modulePath;
        }
    }

    export class TopLevelImportResolverWithCache implements ITopLevelImportResolver {
        private directories = new StringHashTable<DirectoryResolverWithCache>();
        private resolver: ITopLevelImportResolver;

        constructor(private host: ITopLevelImportResolverHost) {
            this.resolver = new TopLevelImportResolver(host);
        }

        resolve(referencingModulePath: string, moduleIdentifier: string): IResolvedImport {
            var directoryPath = this.host.getParentDirectory(referencingModulePath);
            var directoryResolver = this.directories.lookup(directoryPath);

            if (!directoryResolver) {
                directoryResolver = new DirectoryResolverWithCache(this.resolver);
                this.directories.add(directoryPath, directoryResolver);
            }

            return directoryResolver.resolve(referencingModulePath, moduleIdentifier);
        }
    }
}