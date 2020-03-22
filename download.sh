#!/bin/bash

[ ! -f ./download_list ] && echo "Please add a download_list config file" && exit 1

mkdir -p .downloads
mkdir -p roms

pushd roms

SAVEIFS=$IFS
IFS=$(echo -en "\n\b")
for file in *
do
	if [[ -L "$file" && -d "$file" ]]
	then
		unlink "$file"
	fi
done
IFS=$SAVEIFS

popd

pushd .downloads

sed '/^[ \t]*$/d' ../download_list | while read line; do
	dl_url="$(echo "$line" | tr -s '\t' | cut -d$'\t' -f1)"
	dest_dir_config="$(echo "$line" | tr -s '\t' | cut -s -d$'\t' -f2)"
	dl_dir="$(echo $dl_url | sed 's/^http\(\|s\):\/\///g' | sed 's:/*$::' | sed 's@+@ @g;s@%@\\x@g' | xargs -0 printf '%b')"
	dest_dir_default="$(basename "$dl_dir")"
	dest_dir="$dest_dir_default"
	[ ! -z "$dest_dir_config" ] && dest_dir="$dest_dir_config"
	wget -r -l inf -np -nc -c -U "eye01" -R "index.html*" "$dl_url"
	ln -s "../.downloads/$dl_dir" "../roms/$dest_dir"
done

popd
